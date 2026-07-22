import mongoose from "mongoose";

/**
 * Admin-facing notification.
 *
 * Notifications are broadcast to every admin rather than addressed to one, so
 * read state is tracked per admin through `readBy` instead of a single boolean.
 */
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "enquiry_created",
        "enquiry_status_changed",
        "enquiry_converted",
      ],
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Module the notification belongs to — lets the UI group/filter later
    module: {
      type: String,
      default: "enquiry",
      index: true,
    },

    // Source document, so notifications can be cleaned up when it is deleted
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    entityModel: {
      type: String,
      default: "Enquiry",
    },

    // Client-side route opened when the notification is clicked
    link: {
      type: String,
      default: "",
    },

    // Free-form extras (previous/next status, customer name, ...)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Admin who triggered it — absent for public website submissions
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// The list is always sorted newest-first
notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
