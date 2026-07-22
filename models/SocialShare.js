import mongoose from "mongoose";

import { SOCIAL_PLATFORM_KEYS } from "../config/socialPlatforms.js";

export const SHARE_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
};

/**
 * One attempt to push a blog post to a social platform.
 *
 * Every attempt is recorded — including the skipped ones — so the admin panel
 * can show exactly what happened rather than failing silently.
 */
const socialShareSchema = new mongoose.Schema(
  {
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
      index: true,
    },

    blogTitle: { type: String, default: "" },

    platform: {
      type: String,
      enum: SOCIAL_PLATFORM_KEYS,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(SHARE_STATUS),
      default: SHARE_STATUS.PENDING,
      index: true,
    },

    message: { type: String, default: "" },

    /** Permalink of the created post, when the platform returns one. */
    postUrl: { type: String, default: "" },

    /** Why it was skipped or how it failed — shown verbatim in the UI. */
    detail: { type: String, default: "" },

    attemptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

socialShareSchema.index({ createdAt: -1 });

export default mongoose.model("SocialShare", socialShareSchema);
