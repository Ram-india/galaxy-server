import express from "express";

import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} from "../controller/projectController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public Routes (Website)
router.get("/public", getProjects);
router.get("/public/:id", getProject);

// Protected Routes (Admin Panel)
router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  upload.array("images", 10),
  createProject
);

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  getProjects
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  getProject
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  upload.array("images", 10),
  updateProject
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.PROJECT_DELETE),
  deleteProject
);

export default router;
