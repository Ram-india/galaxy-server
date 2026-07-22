import Blog from "../models/Blog.js";
import SocialShare from "../models/SocialShare.js";
import { shareToPlatform } from "../services/socialPublisher.js";
import { AUTO_POST_PLATFORMS } from "../config/socialPlatforms.js";

/** GET /api/site-settings/shares — recent auto-post attempts. */
export const getShareHistory = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const shares = await SocialShare.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("attemptedBy", "name");

    res.status(200).json({ shares });
  } catch (error) {
    console.error("Get Share History Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/site-settings/shares/:blogId
 * Manually pushes a post to social, e.g. to retry a failed attempt.
 */
export const shareBlogNow = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.blogId);

    if (!blog) {
      return res.status(404).json({ message: "Post not found." });
    }

    const requested = Array.isArray(req.body.platforms)
      ? req.body.platforms.filter((item) => AUTO_POST_PLATFORMS.includes(item))
      : AUTO_POST_PLATFORMS;

    if (requested.length === 0) {
      return res
        .status(400)
        .json({ message: "No shareable platform was requested." });
    }

    const results = await Promise.all(
      requested.map((platform) => shareToPlatform(blog, platform, req.admin.id))
    );

    const sent = results.filter((item) => item.status === "sent").length;
    const skipped = results.filter((item) => item.status === "skipped");

    res.status(200).json({
      message:
        sent > 0
          ? `Shared to ${sent} platform${sent > 1 ? "s" : ""}.`
          : skipped[0]?.detail || "Nothing was shared.",
      results,
    });
  } catch (error) {
    console.error("Share Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};
