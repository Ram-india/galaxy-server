import SiteSetting from "../models/SiteSetting.js";
import { SOCIAL_PLATFORM_KEYS } from "../config/socialPlatforms.js";

/**
 * Shapes the document for a client. Integration credentials are reduced to a
 * connection status — access tokens must never reach the browser.
 */
const toClientShape = (settings, { includeIntegrationStatus = false } = {}) => {
  const plain = settings.toObject ? settings.toObject() : settings;
  const { integrations, __v, key, ...rest } = plain;

  if (!includeIntegrationStatus) return rest;

  const statusFor = (name) => ({
    isEnabled: Boolean(integrations?.[name]?.isEnabled),
    // The token itself stays server-side; the UI only needs to know if it exists
    isConfigured: Boolean(
      integrations?.[name]?.accessToken && integrations?.[name]?.targetId
    ),
    targetId: integrations?.[name]?.targetId || "",
    connectedAt: integrations?.[name]?.connectedAt || null,
  });

  return {
    ...rest,
    integrations: {
      linkedin: statusFor("linkedin"),
      facebook: statusFor("facebook"),
    },
  };
};

/**
 * GET /api/site-settings/public
 * Consumed by the website. Public by design — everything here is already
 * printed on the site itself.
 */
export const getPublicSiteSettings = async (req, res) => {
  try {
    const settings = await SiteSetting.getSingleton();
    const payload = toClientShape(settings);

    // The site only wants links it should actually render
    payload.socials = (payload.socials || [])
      .filter((item) => item.isEnabled && item.url)
      .sort((a, b) => a.order - b.order);

    res.status(200).json(payload);
  } catch (error) {
    console.error("Get Public Site Settings Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/site-settings — admin view, including every disabled link. */
export const getSiteSettings = async (req, res) => {
  try {
    const settings = await SiteSetting.getSingleton({ withIntegrations: true });

    res
      .status(200)
      .json(toClientShape(settings, { includeIntegrationStatus: true }));
  } catch (error) {
    console.error("Get Site Settings Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/site-settings */
export const updateSiteSettings = async (req, res) => {
  try {
    const { identity, contact, socials, seo, autoPost } = req.body;
    const settings = await SiteSetting.getSingleton({ withIntegrations: true });

    if (identity) {
      // Logo fields are owned by the upload endpoint, not this one
      const { logoUrl, logoPublicId, ...editable } = identity;
      Object.assign(settings.identity, editable);
    }

    if (contact) {
      Object.assign(settings.contact, {
        ...contact,
        addressLines: Array.isArray(contact.addressLines)
          ? contact.addressLines.filter((line) => line?.trim())
          : settings.contact.addressLines,
        hours: Array.isArray(contact.hours) ? contact.hours : settings.contact.hours,
      });
    }

    if (Array.isArray(socials)) {
      const cleaned = socials
        .filter((item) => SOCIAL_PLATFORM_KEYS.includes(item.platform))
        .map((item, index) => ({
          platform: item.platform,
          url: (item.url || "").trim(),
          isEnabled: Boolean(item.isEnabled),
          order: Number.isFinite(item.order) ? item.order : index,
        }));

      const invalid = cleaned.find(
        (item) => item.url && !/^https?:\/\//i.test(item.url)
      );
      if (invalid) {
        return res.status(400).json({
          message: `The ${invalid.platform} URL must start with http:// or https://`,
        });
      }

      settings.socials = cleaned;
    }

    if (seo) {
      const { ogImageUrl, ogImagePublicId, ...editable } = seo;
      Object.assign(settings.seo, editable);
    }

    if (autoPost) {
      settings.autoPost = {
        ...settings.autoPost.toObject?.() ?? settings.autoPost,
        ...autoPost,
        platforms: Array.isArray(autoPost.platforms)
          ? autoPost.platforms.filter((item) =>
              SOCIAL_PLATFORM_KEYS.includes(item)
            )
          : settings.autoPost.platforms,
      };
    }

    settings.updatedBy = req.admin.id;
    await settings.save();

    res.status(200).json({
      message: "Website settings saved.",
      settings: toClientShape(settings, { includeIntegrationStatus: true }),
    });
  } catch (error) {
    console.error("Update Site Settings Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/site-settings/logo — multipart, handled by the upload middleware. */
export const updateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }

    // multer-storage-cloudinary v2 exposes secure_url/public_id; v4 uses
    // path/filename. Read both so an upgrade cannot blank the logo.
    const url = req.file.secure_url || req.file.url || req.file.path;
    const publicId = req.file.public_id || req.file.filename;

    if (!url) {
      console.error("Logo upload returned no URL:", req.file);
      return res
        .status(502)
        .json({ message: "The image service did not return a URL." });
    }

    const settings = await SiteSetting.getSingleton({ withIntegrations: true });
    const target = req.params.kind === "og" ? "seo" : "identity";

    if (target === "seo") {
      settings.seo.ogImageUrl = url;
      settings.seo.ogImagePublicId = publicId || "";
    } else {
      settings.identity.logoUrl = url;
      settings.identity.logoPublicId = publicId || "";
    }

    settings.updatedBy = req.admin.id;
    await settings.save();

    res.status(200).json({
      message: "Image updated.",
      settings: toClientShape(settings, { includeIntegrationStatus: true }),
    });
  } catch (error) {
    console.error("Update Logo Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/site-settings/integrations/:platform
 * Stores the credentials used for auto-posting. Send an empty accessToken to
 * disconnect.
 */
export const updateIntegration = async (req, res) => {
  try {
    const { platform } = req.params;

    if (!["linkedin", "facebook"].includes(platform)) {
      return res
        .status(400)
        .json({ message: "That platform does not support auto-posting." });
    }

    const { accessToken, targetId, isEnabled } = req.body;
    const settings = await SiteSetting.getSingleton({ withIntegrations: true });
    const integration = settings.integrations[platform];

    // An empty token means "disconnect"
    if (accessToken === "") {
      integration.accessToken = "";
      integration.targetId = "";
      integration.isEnabled = false;
      integration.connectedAt = null;
    } else {
      if (accessToken) {
        integration.accessToken = accessToken;
        integration.connectedAt = new Date();
      }
      if (targetId !== undefined) integration.targetId = targetId;
      if (isEnabled !== undefined) integration.isEnabled = Boolean(isEnabled);
    }

    settings.updatedBy = req.admin.id;
    await settings.save();

    res.status(200).json({
      message:
        accessToken === ""
          ? `${platform} disconnected.`
          : `${platform} connection saved.`,
      settings: toClientShape(settings, { includeIntegrationStatus: true }),
    });
  } catch (error) {
    console.error("Update Integration Error:", error);
    res.status(500).json({ message: error.message });
  }
};
