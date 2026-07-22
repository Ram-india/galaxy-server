import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";
import {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../controller/enquiryController.js";

const router = express.Router();

// Public Routes (Website)
router.post("/", createEnquiry);

// Protected Routes (Admin Panel)
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ENQUIRY_VIEW),
  getEnquiries
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ENQUIRY_VIEW),
  getEnquiry
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ENQUIRY_UPDATE),
  updateEnquiry
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ENQUIRY_DELETE),
  deleteEnquiry
);

export default router;
