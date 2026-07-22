/**
 * Prints a fresh invite link for a pending member.
 *
 * Invite tokens are stored hashed, so an existing link can never be recovered —
 * only replaced. Use this when SMTP is not configured (or the email was lost)
 * and you need to hand someone their link directly.
 *
 *   node scripts/inviteLink.js                    # list pending invites
 *   node scripts/inviteLink.js user@example.com   # reissue and print the link
 *
 * Reissuing invalidates any link previously sent to that person.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Admin, { ACCOUNT_STATUS } from "../models/Admin.js";

const email = process.argv[2];

const buildClientUrl = (path) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  return `${base}${path}`;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const pending = await Admin.find({ status: ACCOUNT_STATUS.INVITED });

  if (pending.length === 0) {
    console.log("No pending invitations.");
    await mongoose.disconnect();
    return;
  }

  if (!email) {
    console.log("Pending invitations:\n");
    pending.forEach((member) => {
      console.log(`  ${member.email.padEnd(30)} ${member.role}`);
    });
    console.log("\nRe-run with an email address to reissue that link.");
    await mongoose.disconnect();
    return;
  }

  const member = pending.find(
    (candidate) => candidate.email === email.toLowerCase()
  );

  if (!member) {
    console.error(`No pending invitation for ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const rawToken = member.createInviteToken();
  await member.save({ validateModifiedOnly: true });

  console.log(`\nInvite link for ${member.email} (${member.role}):\n`);
  console.log(`  ${buildClientUrl(`/accept-invite/${rawToken}`)}\n`);
  console.log("Valid for 7 days. Any earlier link for this person is now dead.");

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
