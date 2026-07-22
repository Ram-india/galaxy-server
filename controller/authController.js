import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";
import { ROLES, getPermissionsForRole } from "../config/permissions.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import cloudinary from "../config/cloudinary.js";

const TOKEN_TTL = "1d";
const MIN_PASSWORD_LENGTH = 8;

const signToken = (adminId) =>
  jwt.sign({ id: adminId }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

/** Everything the client is allowed to know about an account. */
const toAuthPayload = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  status: admin.status,
  phone: admin.phone || "",
  designation: admin.designation || "",
  avatar: admin.avatar?.url || "",
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
  permissions: getPermissionsForRole(admin.role),
});

const hashPassword = async (plain) => bcrypt.hash(plain, await bcrypt.genSalt(10));

/** Shared password policy — mirrored by the strength meter in the UI. */
const validatePassword = (password) => {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must contain both uppercase and lowercase letters.";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }
  return null;
};

const buildClientUrl = (path) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  return `${base}${path}`;
};

/* -------------------------------------------------------------- onboarding */

/**
 * GET /api/auth/registration-status
 * Tells the login/register screens whether public signup is still open.
 */
export const getRegistrationStatus = async (req, res) => {
  try {
    const adminCount = await Admin.estimatedDocumentCount();

    res.status(200).json({
      // Only the very first account may self-register; after that it is
      // invite-only, so the register screen redirects to login.
      isOpen: adminCount === 0,
      isFirstAdmin: adminCount === 0,
    });
  } catch (error) {
    console.error("Registration Status Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * POST /api/auth/register
 * Creates the Owner account. Closed permanently once any account exists.
 */
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required." });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Self-registration exists only to bootstrap the very first account
    const adminCount = await Admin.estimatedDocumentCount();
    if (adminCount > 0) {
      return res.status(403).json({
        message:
          "Public registration is closed. Ask an administrator for an invitation.",
      });
    }

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(400).json({ message: "User already exists" });
    }

    const admin = await Admin.create({
      name,
      email,
      password: await hashPassword(password),
      role: ROLES.OWNER,
      status: ACCOUNT_STATUS.ACTIVE,
      passwordChangedAt: new Date(),
      lastLoginAt: new Date(),
    });

    res.status(201).json({
      message: "Owner account created successfully",
      admin: toAuthPayload(admin),
      token: signToken(admin._id),
    });
  } catch (error) {
    console.error("Error registering admin", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ session */

/** POST /api/auth/login */
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // `password` is select:false on the schema, so ask for it explicitly
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    // Same message for unknown email and wrong password — never reveal which
    if (!admin || !admin.password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (admin.status === ACCOUNT_STATUS.DISABLED) {
      return res.status(403).json({
        message: "Your account has been disabled. Contact an administrator.",
      });
    }

    if (admin.status === ACCOUNT_STATUS.INVITED) {
      return res.status(403).json({
        message: "Please accept your invitation email to activate your account.",
      });
    }

    // Stamped with updateOne rather than save() on purpose: save() validates the
    // whole document, so a legacy account missing a field it never had would
    // fail to sign in. Touching lastLoginAt must not depend on the rest.
    await Admin.updateOne(
      { _id: admin._id },
      { $set: { lastLoginAt: new Date() } }
    );

    res.status(200).json({
      message: "Admin logged in successfully",
      admin: toAuthPayload(admin),
      token: signToken(admin._id),
    });
  } catch (error) {
    console.error("Error logging in admin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/** GET /api/auth/me — rehydrates the client after a refresh. */
export const getMe = async (req, res) => {
  try {
    res.status(200).json({ admin: toAuthPayload(req.admin.document) });
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* --------------------------------------------------------- password reset */

/**
 * POST /api/auth/forgot-password
 * Always answers 200 so the endpoint cannot be used to discover which email
 * addresses have accounts.
 */
export const forgotPassword = async (req, res) => {
  const genericResponse = {
    message:
      "If an account exists for that email, a reset link is on its way.",
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin || admin.status === ACCOUNT_STATUS.DISABLED) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = admin.createPasswordResetToken();
    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    const { delivered } = await sendPasswordResetEmail({
      to: admin.email,
      name: admin.name,
      resetUrl: buildClientUrl(`/reset-password/${rawToken}`),
    });

    res.status(200).json({
      ...genericResponse,
      // Surfaced only when SMTP is unconfigured, so local development is not
      // blocked on mail credentials.
      emailDelivered: delivered,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(200).json(genericResponse);
  }
};

/** GET /api/auth/reset-password/:token — lets the UI validate before showing the form. */
export const verifyResetToken = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      passwordResetToken: Admin.hashToken(req.params.token),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!admin) {
      return res
        .status(400)
        .json({ valid: false, message: "This reset link is invalid or has expired." });
    }

    res.status(200).json({ valid: true, email: admin.email, name: admin.name });
  } catch (error) {
    console.error("Verify Reset Token Error:", error);
    res.status(500).json({ valid: false, message: "Server Error" });
  }
};

/** POST /api/auth/reset-password/:token */
export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const admin = await Admin.findOne({
      passwordResetToken: Admin.hashToken(req.params.token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!admin) {
      return res
        .status(400)
        .json({ message: "This reset link is invalid or has expired." });
    }

    admin.password = await hashPassword(password);
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;
    // Invalidates every session issued before this moment
    admin.passwordChangedAt = new Date();

    // A member who resets their password has proven ownership of the inbox
    if (admin.status === ACCOUNT_STATUS.INVITED) {
      admin.status = ACCOUNT_STATUS.ACTIVE;
    }

    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    res.status(200).json({
      message: "Password updated. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* -------------------------------------------------------------- invitations */

/** GET /api/auth/invite/:token — validated before rendering the accept form. */
export const verifyInviteToken = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      inviteToken: Admin.hashToken(req.params.token),
      inviteExpires: { $gt: new Date() },
    }).populate("invitedBy", "name");

    if (!admin) {
      return res.status(400).json({
        valid: false,
        message: "This invitation is invalid or has expired.",
      });
    }

    res.status(200).json({
      valid: true,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      invitedBy: admin.invitedBy?.name || null,
    });
  } catch (error) {
    console.error("Verify Invite Error:", error);
    res.status(500).json({ valid: false, message: "Server Error" });
  }
};

/**
 * POST /api/auth/invite/:token
 * Sets the name/password on an invited account and signs the member straight in.
 */
export const acceptInvite = async (req, res) => {
  try {
    const { name, password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const admin = await Admin.findOne({
      inviteToken: Admin.hashToken(req.params.token),
      inviteExpires: { $gt: new Date() },
    }).select("+inviteToken +inviteExpires");

    if (!admin) {
      return res
        .status(400)
        .json({ message: "This invitation is invalid or has expired." });
    }

    if (name) admin.name = name;
    admin.password = await hashPassword(password);
    admin.status = ACCOUNT_STATUS.ACTIVE;
    admin.passwordChangedAt = new Date();
    admin.lastLoginAt = new Date();
    admin.inviteToken = undefined;
    admin.inviteExpires = undefined;

    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    res.status(200).json({
      message: "Welcome aboard!",
      admin: toAuthPayload(admin),
      token: signToken(admin._id),
    });
  } catch (error) {
    console.error("Accept Invite Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ profile */

/** PUT /api/auth/profile */
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, designation } = req.body;
    const admin = req.admin.document;

    // Email is deliberately not editable here — changing it would need a
    // verification round-trip to the new address.
    if (name !== undefined) admin.name = name;
    if (phone !== undefined) admin.phone = phone;
    if (designation !== undefined) admin.designation = designation;

    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    res.status(200).json({
      message: "Profile updated",
      admin: toAuthPayload(admin),
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** PUT /api/auth/profile/avatar — multipart, handled by the upload middleware. */
export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }

    // multer-storage-cloudinary v2 returns secure_url/public_id, while v4
    // returns path/filename. Read both so an upgrade cannot silently blank the
    // avatar the way it did before.
    const url = req.file.secure_url || req.file.url || req.file.path;
    const publicId = req.file.public_id || req.file.filename;

    if (!url) {
      console.error("Avatar upload returned no URL:", req.file);
      return res
        .status(502)
        .json({ message: "The image service did not return a URL." });
    }

    const admin = req.admin.document;
    const previousPublicId = admin.avatar?.publicId;

    admin.avatar = { url, publicId: publicId || "" };

    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    // Clean up the replaced image. Best-effort: a failure here must not turn a
    // successful upload into an error for the user.
    if (previousPublicId && previousPublicId !== publicId) {
      try {
        await cloudinary.v2.uploader.destroy(previousPublicId);
      } catch (cleanupError) {
        console.error("Could not remove the previous avatar:", cleanupError);
      }
    }

    res.status(200).json({
      message: "Photo updated",
      admin: toAuthPayload(admin),
    });
  } catch (error) {
    console.error("Update Avatar Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** PUT /api/auth/password */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required." });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const admin = await Admin.findById(req.admin.id).select("+password");

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Your current password is incorrect." });
    }

    admin.password = await hashPassword(newPassword);
    admin.passwordChangedAt = new Date();
    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await admin.save({ validateModifiedOnly: true });

    // The old token is now rejected, so hand back a fresh one and keep the
    // current tab signed in while every other session is logged out.
    res.status(200).json({
      message: "Password changed successfully",
      token: signToken(admin._id),
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
