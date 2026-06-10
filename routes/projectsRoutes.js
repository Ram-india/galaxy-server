import express from "express";

import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} from "../controller/projectController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public Routes (Website)
router.get("/public", getProjects);
router.get("/public/:id", getProject);

// Protected Routes (Admin Panel)
router.post(
  "/",
  authMiddleware,
  upload.array("images", 10),
  createProject
);

router.get(
  "/",
  authMiddleware,
  getProjects
);

router.get(
  "/:id",
  authMiddleware,
  getProject
);

router.put(
  "/:id",
  authMiddleware,
  upload.array("images", 10),
  updateProject
);

router.delete(
  "/:id",
  authMiddleware,
  deleteProject
);

export default router;