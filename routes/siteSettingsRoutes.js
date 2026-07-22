import express from "express";

import {
  getPublicSiteSettings,
  getSiteSettings,
  updateSiteSettings,
  updateLogo,
  updateIntegration,
} from "../controller/siteSettingsController.js";
import {
  getShareHistory,
  shareBlogNow,
} from "../controller/socialShareController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";
import { createImageUpload } from "../middleware/imageUpload.js";

const router = express.Router();

const uploadBranding = createImageUpload({
  folder: "gps-branding",
  field: "image",
  maxBytes: 2 * 1024 * 1024,
});

// Public — the website reads this on every page load
router.get("/public", getPublicSiteSettings);

// Everything below is admin-only
router.use(authMiddleware);

router.get("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), getSiteSettings);
router.put("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), updateSiteSettings);

// :kind is "logo" or "og"
router.put(
  "/image/:kind",
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  uploadBranding,
  updateLogo
);

router.put(
  "/integrations/:platform",
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  updateIntegration
);

// Social share history and manual re-share
router.get("/shares", requirePermission(PERMISSIONS.BLOG_VIEW), getShareHistory);
router.post(
  "/shares/:blogId",
  requirePermission(PERMISSIONS.BLOG_PUBLISH),
  shareBlogNow
);

export default router;
