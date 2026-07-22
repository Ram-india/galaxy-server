import mongoose from "mongoose";
import crypto from "crypto";
import { ROLES, ROLE_LIST } from "../config/permissions.js";

/** Account lifecycle: invited -> active, or disabled by an admin. */
export const ACCOUNT_STATUS = {
  INVITED: "invited",
  ACTIVE: "active",
  DISABLED: "disabled",
};

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Invited members have no password until they accept, so this is optional
    // at the schema level and enforced in the controllers instead.
    password: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ROLE_LIST,
      default: ROLES.VIEWER,
    },

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE,
      index: true,
    },

    /* ------------------------------------------------------------ profile */

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    designation: {
      type: String,
      trim: true,
      default: "",
    },

    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    /* ------------------------------------------------------------ security */

    // Tokens are stored hashed — a database leak must not hand out live
    // reset/invite links.
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    inviteToken: { type: String, select: false },
    inviteExpires: { type: Date, select: false },

    // Any token issued before this timestamp is rejected, so changing a
    // password (or being disabled) logs every existing session out.
    passwordChangedAt: { type: Date, default: null },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Creates a random token, stores its hash on the document, and returns the
 * plain value — the only copy, which goes into the emailed link.
 */
const issueToken = function (tokenField, expiryField, ttlMs) {
  const rawToken = crypto.randomBytes(32).toString("hex");

  this[tokenField] = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  this[expiryField] = new Date(Date.now() + ttlMs);

  return rawToken;
};

/** Reset links live for one hour. */
adminSchema.methods.createPasswordResetToken = function () {
  return issueToken.call(
    this,
    "passwordResetToken",
    "passwordResetExpires",
    60 * 60 * 1000
  );
};

/** Invites live for seven days. */
adminSchema.methods.createInviteToken = function () {
  return issueToken.call(
    this,
    "inviteToken",
    "inviteExpires",
    7 * 24 * 60 * 60 * 1000
  );
};

/** Hashes a token from a URL so it can be matched against the stored hash. */
adminSchema.statics.hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

/** True when the JWT was issued before the password last changed. */
adminSchema.methods.passwordChangedAfter = function (jwtIssuedAtSeconds) {
  if (!this.passwordChangedAt) return false;

  const changedAtSeconds = Math.floor(
    this.passwordChangedAt.getTime() / 1000
  );

  return changedAtSeconds > jwtIssuedAtSeconds;
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
