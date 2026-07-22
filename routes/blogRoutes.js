import express from "express";

import {
  getPublicBlogs,
  getPublicBlog,
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  updateBlogStatus,
  deleteBlog,
} from "../controller/blogController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { createImageUpload } from "../middleware/imageUpload.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

const uploadCover = createImageUpload({
  folder: "gps-blogs",
  field: "coverImage",
  maxBytes: 4 * 1024 * 1024,
});

/* ------------------------------------------------------------------ public */
/* Declared before "/:id" so the literal path is not captured as an id. */

router.get("/public", getPublicBlogs);
router.get("/public/:slug", getPublicBlog);

/* --------------------------------------------------------------- protected */

router.get("/", authMiddleware, requirePermission(PERMISSIONS.BLOG_VIEW), getBlogs);
router.get("/:id", authMiddleware, requirePermission(PERMISSIONS.BLOG_VIEW), getBlog);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.BLOG_CREATE),
  uploadCover,
  createBlog
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.BLOG_UPDATE),
  uploadCover,
  updateBlog
);

router.patch(
  "/:id/status",
  authMiddleware,
  requirePermission(PERMISSIONS.BLOG_PUBLISH),
  updateBlogStatus
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.BLOG_DELETE),
  deleteBlog
);

export default router;
