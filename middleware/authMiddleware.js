import jwt from "jsonwebtoken";
import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";
import { getPermissionsForRole } from "../config/permissions.js";

/**
 * Verifies the JWT and loads the live account.
 *
 * The token alone is not trusted: the account is re-read on every request so a
 * disabled member, a deleted account, or a password change immediately
 * invalidates sessions that were issued earlier.
 *
 * Populates `req.admin` with { id, name, email, role, permissions, document }.
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Allow CORS preflight requests through without authentication
    if (req.method === "OPTIONS") return next();

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({ message: "Account no longer exists" });
    }

    if (admin.status === ACCOUNT_STATUS.DISABLED) {
      return res.status(403).json({
        message: "Your account has been disabled. Contact an administrator.",
      });
    }

    if (admin.status === ACCOUNT_STATUS.INVITED) {
      return res.status(403).json({
        message: "Please accept your invitation before signing in.",
      });
    }

    // Password changed after this token was issued -> force a fresh login
    if (admin.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        message: "Your password was changed. Please sign in again.",
      });
    }

    req.admin = {
      id: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: getPermissionsForRole(admin.role),
      document: admin,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired. Please sign in again." });
    }

    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
