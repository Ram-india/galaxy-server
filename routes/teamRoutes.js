import express from "express";

import {
  getTeamMembers,
  getRoles,
  inviteMember,
  resendInvite,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
} from "../controller/teamController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission(PERMISSIONS.TEAM_VIEW), getTeamMembers);
router.get("/roles", requirePermission(PERMISSIONS.TEAM_VIEW), getRoles);

router.post("/invite", requirePermission(PERMISSIONS.TEAM_INVITE), inviteMember);
router.post(
  "/:id/resend-invite",
  requirePermission(PERMISSIONS.TEAM_INVITE),
  resendInvite
);

router.patch(
  "/:id/role",
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  updateMemberRole
);
router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  updateMemberStatus
);

router.delete("/:id", requirePermission(PERMISSIONS.TEAM_MANAGE), removeMember);

export default router;
