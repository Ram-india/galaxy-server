import SiteSetting from "../models/SiteSetting.js";
import SocialShare, { SHARE_STATUS } from "../models/SocialShare.js";

/**
 * Pushes published blog posts to connected social platforms.
 *
 * Every platform needs credentials the owner must supply (see the Integrations
 * tab in Website Settings). When they are missing the attempt is recorded as
 * `skipped` with the reason — publishing a post must never fail because a
 * social network is unreachable or unconfigured.
 */

/** Fills {title}, {excerpt} and {url} in the configured template. */
const buildMessage = (template, blog, url) =>
  (template || "{title}\n\n{url}")
    .replaceAll("{title}", blog.title || "")
    .replaceAll("{excerpt}", blog.excerpt || "")
    .replaceAll("{url}", url)
    .trim();

const buildPostUrl = (settings, blog) => {
  const base = (
    settings.identity?.siteUrl || process.env.CLIENT_URL || ""
  ).replace(/\/$/, "");

  return `${base}/blog/${blog.slug}`;
};

/* --------------------------------------------------------------- adapters */

/**
 * LinkedIn UGC post against an organization.
 * `targetId` is the organization URN, e.g. "urn:li:organization:12345".
 */
const postToLinkedIn = async ({ accessToken, targetId }, message, url) => {
  const author = targetId.startsWith("urn:")
    ? targetId
    : `urn:li:organization:${targetId}`;

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: message },
          shareMediaCategory: "ARTICLE",
          media: [{ status: "READY", originalUrl: url }],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.message || `LinkedIn responded ${response.status}`
    );
  }

  const postId = body.id || "";
  return {
    postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : "",
  };
};

/** Facebook Page feed post. `targetId` is the page id. */
const postToFacebook = async ({ accessToken, targetId }, message, url) => {
  const endpoint = `https://graph.facebook.com/v21.0/${targetId}/feed`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, link: url, access_token: accessToken }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error?.message || `Facebook responded ${response.status}`
    );
  }

  return {
    postUrl: body.id ? `https://www.facebook.com/${body.id}` : "",
  };
};

const ADAPTERS = {
  linkedin: postToLinkedIn,
  facebook: postToFacebook,
};

/* ------------------------------------------------------------------ runner */

/**
 * Shares one blog post to one platform, recording the outcome either way.
 * @returns {Promise<SocialShare>} the persisted attempt
 */
export const shareToPlatform = async (blog, platform, adminId = null) => {
  const settings = await SiteSetting.getSingleton({ withIntegrations: true });
  const url = buildPostUrl(settings, blog);
  const message = buildMessage(settings.autoPost?.messageTemplate, blog, url);

  const record = {
    blog: blog._id,
    blogTitle: blog.title,
    platform,
    message,
    attemptedBy: adminId,
  };

  const adapter = ADAPTERS[platform];
  const credentials = settings.integrations?.[platform];

  if (!adapter) {
    return SocialShare.create({
      ...record,
      status: SHARE_STATUS.SKIPPED,
      detail: `No publisher exists for ${platform}.`,
    });
  }

  if (!credentials?.accessToken || !credentials?.targetId) {
    return SocialShare.create({
      ...record,
      status: SHARE_STATUS.SKIPPED,
      detail: `${platform} is not connected. Add an access token and target id under Website Settings → Integrations.`,
    });
  }

  if (!credentials.isEnabled) {
    return SocialShare.create({
      ...record,
      status: SHARE_STATUS.SKIPPED,
      detail: `${platform} auto-posting is switched off.`,
    });
  }

  try {
    const { postUrl } = await adapter(credentials, message, url);

    return SocialShare.create({
      ...record,
      status: SHARE_STATUS.SENT,
      postUrl,
    });
  } catch (error) {
    console.error(`Social share to ${platform} failed:`, error);

    return SocialShare.create({
      ...record,
      status: SHARE_STATUS.FAILED,
      detail: error.message,
    });
  }
};

/**
 * Fans a newly published post out to every configured platform.
 * Never throws: publishing must succeed regardless of what social does.
 */
export const shareOnPublish = async (blog, adminId = null) => {
  try {
    const settings = await SiteSetting.getSingleton({ withIntegrations: true });

    if (!settings.autoPost?.isEnabled) return [];

    const platforms = settings.autoPost.platforms || [];
    if (platforms.length === 0) return [];

    return await Promise.all(
      platforms.map((platform) => shareToPlatform(blog, platform, adminId))
    );
  } catch (error) {
    console.error("Auto-share failed:", error);
    return [];
  }
};
