/**
 * Break-glass tool: set any account's role directly from the command line.
 *
 * Registration is invite-only after the first account, and roles are otherwise
 * only changeable by someone who already has team.manage. This script is the
 * way out of a chicken-and-egg lockout — for example when every account has
 * ended up as Viewer and nobody can promote anyone.
 *
 *   node scripts/setRole.js ram@gmail.com Owner
 *   node scripts/setRole.js ram@gmail.com Owner --apply
 *
 * Without --apply it only prints what it would do.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";
import { ROLE_LIST } from "../config/permissions.js";

dotenv.config();

const [email, role] = process.argv.slice(2);
const shouldApply = process.argv.includes("--apply");

const usage = () => {
  console.log("Usage: node scripts/setRole.js <email> <role> [--apply]");
  console.log(`Roles: ${ROLE_LIST.join(" | ")}`);
};

const run = async () => {
  if (!email || !role) {
    usage();
    process.exit(1);
  }

  if (!ROLE_LIST.includes(role)) {
    console.error(`"${role}" is not a valid role.`);
    usage();
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Raw collection write: this must work even on a legacy document that would
  // fail full schema validation (e.g. one still missing `name`).
  const collection = mongoose.connection.db.collection(
    Admin.collection.collectionName
  );

  const account = await collection.findOne({ email: email.toLowerCase() });

  if (!account) {
    console.error(`No account found for ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    `${account.email}: ${account.role || "(no role)"} -> ${role}` +
      (account.status ? "" : `, status -> ${ACCOUNT_STATUS.ACTIVE}`)
  );

  if (!shouldApply) {
    console.log("\nDry run. Re-run with --apply to write this change.");
    await mongoose.disconnect();
    return;
  }

  await collection.updateOne(
    { _id: account._id },
    {
      $set: {
        role,
        // An account you are deliberately promoting should be usable
        status: account.status || ACCOUNT_STATUS.ACTIVE,
        name: account.name || account.username || account.email.split("@")[0],
      },
    }
  );

  console.log(`\nDone. ${account.email} is now ${role}.`);
  console.log("They must sign out and back in for the new role to take effect.");

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
