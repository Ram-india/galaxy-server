import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";
import {
  ROLES,
  ROLE_LIST,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  getPermissionsForRole,
} from "../config/permissions.js";
import { sendInviteEmail } from "../utils/email.js";

const toMemberPayload = (admin) => ({
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
  invitedBy: admin.invitedBy?.name || null,
});

const buildClientUrl = (path) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  return `${base}${path}`;
};

/** Guards the "there must always be one active Owner" invariant. */
const countOtherActiveOwners = (excludeId) =>
  Admin.countDocuments({
    _id: { $ne: excludeId },
    role: ROLES.OWNER,
    status: ACCOUNT_STATUS.ACTIVE,
  });

/* --------------------------------------------------------------------- read */

/** GET /api/team */
export const getTeamMembers = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const query = {};
    if (role && role !== "all") query.role = role;
    if (status && status !== "all") query.status = status;

    if (search) {
      // Escape user input before it becomes a regex
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ];
    }

    const members = await Admin.find(query)
      .sort({ createdAt: -1 })
      .populate("invitedBy", "name");

    const stats = {
      total: await Admin.estimatedDocumentCount(),
      active: await Admin.countDocuments({ status: ACCOUNT_STATUS.ACTIVE }),
      invited: await Admin.countDocuments({ status: ACCOUNT_STATUS.INVITED }),
      disabled: await Admin.countDocuments({ status: ACCOUNT_STATUS.DISABLED }),
    };

    res.status(200).json({
      members: members.map(toMemberPayload),
      stats,
    });
  } catch (error) {
    console.error("Get Team Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** GET /api/team/roles — powers the Roles & Permissions screen. */
export const getRoles = async (req, res) => {
  try {
    const counts = await Admin.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const memberCountByRole = counts.reduce((map, entry) => {
      map[entry._id] = entry.count;
      return map;
    }, {});

    res.status(200).json({
      roles: ROLE_LIST.map((role) => ({
        name: role,
        description: ROLE_DESCRIPTIONS[role],
        permissions: ROLE_PERMISSIONS[role],
        memberCount: memberCountByRole[role] || 0,
      })),
      permissions: Object.values(PERMISSIONS),
    });
  } catch (error) {
    console.error("Get Roles Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ------------------------------------------------------------------ invites */

/** POST /api/team/invite */
export const inviteMember = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    if (!ROLE_LIST.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    // Only an Owner may create another Owner
    if (role === ROLES.OWNER && req.admin.role !== ROLES.OWNER) {
      return res
        .status(403)
        .json({ message: "Only an Owner can invite another Owner." });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Someone with that email is already on the team." });
    }

    const member = new Admin({
      name,
      email,
      role,
      status: ACCOUNT_STATUS.INVITED,
      invitedBy: req.admin.id,
    });

    const rawToken = member.createInviteToken();
    // A brand new document — validate it in full
    await member.save();

    const { delivered } = await sendInviteEmail({
      to: member.email,
      inviterName: req.admin.name,
      role,
      inviteUrl: buildClientUrl(`/accept-invite/${rawToken}`),
    });

    res.status(201).json({
      message: delivered
        ? `Invitation sent to ${member.email}.`
        : `Invitation created. SMTP is not configured, so the link was logged to the server console.`,
      member: toMemberPayload(member),
      emailDelivered: delivered,
    });
  } catch (error) {
    console.error("Invite Member Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** POST /api/team/:id/resend-invite — issues a fresh token, invalidating the old link. */
export const resendInvite = async (req, res) => {
  try {
    const member = await Admin.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (member.status !== ACCOUNT_STATUS.INVITED) {
      return res
        .status(400)
        .json({ message: "This member has already accepted their invite." });
    }

    const rawToken = member.createInviteToken();
    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await member.save({ validateModifiedOnly: true });

    const { delivered } = await sendInviteEmail({
      to: member.email,
      inviterName: req.admin.name,
      role: member.role,
      inviteUrl: buildClientUrl(`/accept-invite/${rawToken}`),
    });

    res.status(200).json({
      message: delivered
        ? `Invitation resent to ${member.email}.`
        : "Invitation regenerated. The link was logged to the server console.",
      emailDelivered: delivered,
    });
  } catch (error) {
    console.error("Resend Invite Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ------------------------------------------------------------------- manage */

/** PATCH /api/team/:id/role */
export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!ROLE_LIST.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    // Changing your own role would let an admin lock themselves out or
    // self-promote; ownership transfer is a deliberate, separate action.
    if (req.params.id === req.admin.id) {
      return res
        .status(400)
        .json({ message: "You cannot change your own role." });
    }

    const member = await Admin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (role === ROLES.OWNER && req.admin.role !== ROLES.OWNER) {
      return res
        .status(403)
        .json({ message: "Only an Owner can promote someone to Owner." });
    }

    // Never leave the workspace without an Owner
    if (member.role === ROLES.OWNER && role !== ROLES.OWNER) {
      const remainingOwners = await countOtherActiveOwners(member._id);
      if (remainingOwners === 0) {
        return res.status(400).json({
          message:
            "This is the only Owner. Promote someone else before changing this role.",
        });
      }
    }

    member.role = role;
    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await member.save({ validateModifiedOnly: true });

    res.status(200).json({
      message: `${member.name} is now ${role}.`,
      member: toMemberPayload(member),
    });
  } catch (error) {
    console.error("Update Role Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** PATCH /api/team/:id/status — enable or disable an account. */
export const updateMemberStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (![ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.DISABLED].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    if (req.params.id === req.admin.id) {
      return res
        .status(400)
        .json({ message: "You cannot disable your own account." });
    }

    const member = await Admin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (member.role === ROLES.OWNER && status === ACCOUNT_STATUS.DISABLED) {
      const remainingOwners = await countOtherActiveOwners(member._id);
      if (remainingOwners === 0) {
        return res
          .status(400)
          .json({ message: "You cannot disable the only Owner." });
      }
    }

    member.status = status;

    // Disabling must end the member's active sessions immediately. The auth
    // middleware rejects disabled accounts, and this also invalidates tokens.
    if (status === ACCOUNT_STATUS.DISABLED) {
      member.passwordChangedAt = new Date();
    }

    // validateModifiedOnly: only the fields this handler touched are checked,
    // so a legacy account with a missing field can still be updated.
    await member.save({ validateModifiedOnly: true });

    res.status(200).json({
      message:
        status === ACCOUNT_STATUS.ACTIVE
          ? `${member.name} has been reactivated.`
          : `${member.name} has been disabled.`,
      member: toMemberPayload(member),
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** DELETE /api/team/:id */
export const removeMember = async (req, res) => {
  try {
    if (req.params.id === req.admin.id) {
      return res
        .status(400)
        .json({ message: "You cannot remove your own account." });
    }

    const member = await Admin.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (member.role === ROLES.OWNER) {
      const remainingOwners = await countOtherActiveOwners(member._id);
      if (remainingOwners === 0) {
        return res
          .status(400)
          .json({ message: "You cannot remove the only Owner." });
      }
    }

    await member.deleteOne();

    res.status(200).json({
      success: true,
      message: `${member.name} has been removed from the team.`,
    });
  } catch (error) {
    console.error("Remove Member Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/** Exposed for tests/debugging: the effective permissions of a role. */
export const getRolePermissions = getPermissionsForRole;
