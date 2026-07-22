import Notification from "../models/Notification.js";

/**
 * Reshapes a document for the client: `readBy` is an implementation detail,
 * the panel only needs a per-admin `isRead` flag.
 */
const toClientShape = (notification, adminId) => {
  const plain = notification.toObject ? notification.toObject() : notification;
  const { readBy = [], ...rest } = plain;

  return {
    ...rest,
    isRead: readBy.some((id) => String(id) === String(adminId)),
  };
};

/**
 * GET /api/notifications
 * Query: page, limit, filter=all|unread, module
 *
 * Returns the page of notifications plus the total unread count, so the bell
 * badge stays correct even when the current page holds only read items.
 */
export const getNotifications = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const query = {};
    if (req.query.module) query.module = req.query.module;
    if (req.query.filter === "unread") query.readBy = { $ne: adminId };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("actor", "name email"),
      Notification.countDocuments(query),
      Notification.countDocuments({ readBy: { $ne: adminId } }),
    ]);

    res.status(200).json({
      notifications: notifications.map((item) => toClientShape(item, adminId)),
      total,
      unreadCount,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** GET /api/notifications/unread-count — cheap endpoint for badge polling. */
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      readBy: { $ne: req.admin.id },
    });

    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error("Unread Count Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** PATCH /api/notifications/:id/read */
export const markAsRead = async (req, res) => {
  try {
    const adminId = req.admin.id;

    // $addToSet keeps this idempotent when several tabs fire at once
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { readBy: adminId } },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json(toClientShape(notification, adminId));
  } catch (error) {
    console.error("Mark As Read Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** PATCH /api/notifications/:id/unread */
export const markAsUnread = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $pull: { readBy: adminId } },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json(toClientShape(notification, adminId));
  } catch (error) {
    console.error("Mark As Unread Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** PATCH /api/notifications/read-all */
export const markAllAsRead = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const result = await Notification.updateMany(
      { readBy: { $ne: adminId } },
      { $addToSet: { readBy: adminId } }
    );

    res.status(200).json({
      success: true,
      updated: result.modifiedCount,
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Mark All As Read Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/notifications/:id */
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Delete Notification Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/notifications — clears everything the admin can see. */
export const clearNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({});

    res.status(200).json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error("Clear Notifications Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
