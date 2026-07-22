import express from "express";

import {
  registerAdmin,
  loginAdmin,
  getMe,
  getRegistrationStatus,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  verifyInviteToken,
  acceptInvite,
  updateProfile,
  updateAvatar,
  changePassword,
} from "../controller/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { uploadAvatar } from "../middleware/avatarUpload.js";

const router = express.Router();

/* ------------------------------------------------------------------ public */

router.get("/registration-status", getRegistrationStatus);
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

router.get("/invite/:token", verifyInviteToken);
router.post("/invite/:token", acceptInvite);

/* --------------------------------------------------------------- protected */

router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, updateProfile);
router.put("/profile/avatar", authMiddleware, uploadAvatar, updateAvatar);
router.put("/password", authMiddleware, changePassword);

export default router;
