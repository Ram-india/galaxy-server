/**
 * One-time migration for accounts created before roles existed.
 *
 * Those documents have no `role` or `status` field, so Mongoose would hydrate
 * them with the schema defaults (role: Viewer) and every existing admin would
 * silently lose access. This restores what they had before: full permissions.
 *
 *   node scripts/migrateAdmins.js            # dry run, prints the plan
 *   node scripts/migrateAdmins.js --apply    # writes the changes
 *
 * Safe to re-run: documents that already have a role are left untouched.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";
import { ROLES } from "../config/permissions.js";

dotenv.config();

const shouldApply = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  // Read through the raw collection so schema defaults do not mask what is
  // actually stored on disk.
  const collection = mongoose.connection.db.collection(
    Admin.collection.collectionName
  );

  const legacyAccounts = await collection
    .find({
      $or: [
        { role: { $exists: false } },
        { status: { $exists: false } },
        // The oldest accounts predate `name` and used `username` instead
        { name: { $exists: false } },
      ],
    })
    .sort({ createdAt: 1 })
    .toArray();

  if (legacyAccounts.length === 0) {
    console.log("Nothing to migrate — every account is already up to date.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${legacyAccounts.length} account(s) to migrate:\n`);

  // The earliest account becomes the Owner; the rest become Admins. Both roles
  // carry every permission, so nobody loses access they had before.
  const plan = legacyAccounts.map((account, index) => ({
    _id: account._id,
    email: account.email,
    role: account.role || (index === 0 ? ROLES.OWNER : ROLES.ADMIN),
    status: account.status || ACCOUNT_STATUS.ACTIVE,
    // Fall back through: existing name -> old username -> the email local part
    name: account.name || account.username || account.email.split("@")[0],
    hadUsername: Boolean(account.username),
  }));

  plan.forEach((entry) => {
    console.log(
      `  ${entry.email.padEnd(28)} -> ${entry.role.padEnd(7)} / ${entry.status.padEnd(
        8
      )} / name: ${entry.name}${entry.hadUsername ? "  (from username)" : ""}`
    );
  });

  if (!shouldApply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    await mongoose.disconnect();
    return;
  }

  const operations = plan.map((entry) => {
    const update = {
      // $set only the fields the new schema needs — no other data is touched
      $set: { role: entry.role, status: entry.status, name: entry.name },
    };

    // Drop the dead `username` field now that its value lives in `name`
    if (entry.hadUsername) update.$unset = { username: "" };

    return { updateOne: { filter: { _id: entry._id }, update } };
  });

  const result = await collection.bulkWrite(operations);
  console.log(`\nUpdated ${result.modifiedCount} account(s).`);

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
