import mongoose from "mongoose";

import { SOCIAL_PLATFORM_KEYS } from "../config/socialPlatforms.js";

/**
 * Website content managed from the admin panel.
 *
 * A singleton: exactly one document exists, fetched through
 * `SiteSetting.getSingleton()`. Storing it as a document rather than a config
 * file is what lets the site be edited without a redeploy.
 */

const businessHourSchema = new mongoose.Schema(
  {
    days: { type: String, trim: true, default: "" },
    time: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: SOCIAL_PLATFORM_KEYS, required: true },
    url: { type: String, trim: true, default: "" },
    isEnabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Credentials for auto-posting. Never leaves the server: `select: false` keeps
 * it out of ordinary reads, and the controllers strip it from every response.
 */
const integrationSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: false },
    accessToken: { type: String, default: "" },
    // LinkedIn organization URN / Facebook page id
    targetId: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const siteSettingSchema = new mongoose.Schema(
  {
    // Fixed key guarantees a single row even under concurrent writes
    key: {
      type: String,
      default: "site",
      unique: true,
      immutable: true,
    },

    identity: {
      siteName: { type: String, trim: true, default: "Galaxy Power Solution" },
      siteUrl: {
        type: String,
        trim: true,
        default: "https://www.galaxypowersolution.com",
      },
      tagline: { type: String, trim: true, default: "" },
      logoUrl: { type: String, default: "" },
      logoPublicId: { type: String, default: "" },
    },

    contact: {
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      careersEmail: { type: String, trim: true, lowercase: true, default: "" },
      whatsapp: { type: String, trim: true, default: "" },
      addressLines: { type: [String], default: [] },
      hours: { type: [businessHourSchema], default: [] },
      mapEmbedUrl: { type: String, trim: true, default: "" },
      directionsUrl: { type: String, trim: true, default: "" },
    },

    socials: { type: [socialLinkSchema], default: [] },

    /** Defaults used when a page supplies no meta of its own. */
    seo: {
      metaTitle: { type: String, trim: true, default: "" },
      metaDescription: { type: String, trim: true, default: "" },
      ogImageUrl: { type: String, default: "" },
      ogImagePublicId: { type: String, default: "" },
    },

    /** Auto-share a blog post the moment it is published. */
    autoPost: {
      isEnabled: { type: Boolean, default: false },
      platforms: { type: [String], default: [] },
      messageTemplate: {
        type: String,
        default: "{title}\n\n{excerpt}\n\nRead more: {url}",
      },
    },

    integrations: {
      type: {
        linkedin: { type: integrationSchema, default: () => ({}) },
        facebook: { type: integrationSchema, default: () => ({}) },
      },
      default: () => ({}),
      select: false,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Returns the settings document, creating it on first use so the admin panel
 * and the website never have to cope with a missing record.
 */
siteSettingSchema.statics.getSingleton = async function (options = {}) {
  const query = this.findOne({ key: "site" });
  if (options.withIntegrations) query.select("+integrations");

  const existing = await query;
  if (existing) return existing;

  return this.create({ key: "site" });
};

export default mongoose.model("SiteSetting", siteSettingSchema);
