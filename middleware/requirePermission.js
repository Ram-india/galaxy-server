/**
 * Route guard. Must run after authMiddleware, which resolves the live role.
 *
 *   router.delete("/:id", authMiddleware, requirePermission(PERMISSIONS.ENQUIRY_DELETE), handler)
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!req.admin.permissions.includes(permission)) {
    return res.status(403).json({
      message: `Your role (${req.admin.role}) does not allow this action.`,
      requiredPermission: permission,
    });
  }

  next();
};

export default requirePermission;
