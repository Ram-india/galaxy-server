import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
} from "../controller/notificationController.js";

const router = express.Router();

// Every notification route is admin-only
router.use(authMiddleware);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);

// Static path must be declared before the "/:id/..." params
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.patch("/:id/unread", markAsUnread);

router.delete("/", clearNotifications);
router.delete("/:id", deleteNotification);

export default router;
