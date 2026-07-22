/**
 * Seeds the website settings from the values currently hardcoded in
 * galaxy-power-solution/src/Data/siteConfig.jsx, so the admin panel starts
 * populated instead of blank.
 *
 *   node scripts/seedSiteSettings.js            # show what would be written
 *   node scripts/seedSiteSettings.js --apply
 *
 * Only fills fields that are still empty — it never overwrites edits made in
 * the admin panel, so it is safe to re-run.
 */

import "dotenv/config";
import mongoose from "mongoose";

import SiteSetting from "../models/SiteSetting.js";

const shouldApply = process.argv.includes("--apply");

const DEFAULTS = {
  identity: {
    siteName: "Galaxy Power Solution",
    siteUrl: "https://www.galaxypowersolution.com",
  },
  contact: {
    phone: "+91 98765 43210",
    email: "info@galaxypowersolution.com",
    careersEmail: "careers@galaxypowersolution.com",
    whatsapp: "919876543210",
    addressLines: ["No. 12, Laksminagar", "Bhavani, Tamil Nadu, India"],
    hours: [
      { days: "Monday – Saturday", time: "9:00 AM – 6:30 PM" },
      { days: "Sunday", time: "Closed" },
    ],
    mapEmbedUrl:
      "https://www.google.com/maps?q=Bhavani,+Tamil+Nadu,+India&output=embed",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=Bhavani,+Tamil+Nadu,+India",
  },
  socials: [
    { platform: "linkedin", url: "https://www.linkedin.com/company/galaxy-power-solution" },
    { platform: "facebook", url: "https://www.facebook.com/galaxypowersolution" },
    { platform: "instagram", url: "https://www.instagram.com/galaxypowersolution" },
    { platform: "youtube", url: "https://www.youtube.com/@galaxypowersolution" },
    { platform: "whatsapp", url: "https://wa.me/919876543210" },
  ],
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const settings = await SiteSetting.getSingleton();
  const changes = [];

  for (const [key, value] of Object.entries(DEFAULTS.identity)) {
    if (!settings.identity[key]) {
      changes.push(`identity.${key} = ${value}`);
      if (shouldApply) settings.identity[key] = value;
    }
  }

  for (const [key, value] of Object.entries(DEFAULTS.contact)) {
    const current = settings.contact[key];
    const isEmpty = Array.isArray(current) ? current.length === 0 : !current;

    if (isEmpty) {
      changes.push(`contact.${key} = ${JSON.stringify(value)}`);
      if (shouldApply) settings.contact[key] = value;
    }
  }

  if (!settings.socials?.length) {
    changes.push(`socials = ${DEFAULTS.socials.length} links`);
    if (shouldApply) {
      settings.socials = DEFAULTS.socials.map((item, index) => ({
        ...item,
        isEnabled: true,
        order: index,
      }));
    }
  }

  if (changes.length === 0) {
    console.log("Nothing to seed — every field already has a value.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${changes.length} field(s) to fill:\n`);
  changes.forEach((line) => console.log(`  ${line}`));

  if (!shouldApply) {
    console.log("\nDry run. Re-run with --apply to write these values.");
    await mongoose.disconnect();
    return;
  }

  await settings.save();
  console.log("\nSeeded. Open Website Settings in the admin panel to review.");
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
