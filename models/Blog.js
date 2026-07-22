import mongoose from "mongoose";

/** Editorial workflow. Only `published` posts are exposed publicly. */
export const BLOG_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

export const BLOG_CATEGORIES = [
  "Solar Basics",
  "Industry News",
  "Case Studies",
  "Maintenance",
  "Government Schemes",
  "Company News",
];

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Public URL segment — the website routes on this, not on _id
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    excerpt: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    /** Markdown source. Rendered by the client, never stored as HTML. */
    content: {
      type: String,
      default: "",
    },

    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    category: {
      type: String,
      enum: BLOG_CATEGORIES,
      default: "Solar Basics",
      index: true,
    },

    tags: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: Object.values(BLOG_STATUS),
      default: BLOG_STATUS.DRAFT,
      index: true,
    },

    // Set the first time a post is published, then preserved
    publishedAt: {
      type: Date,
      default: null,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    /** Estimated minutes to read, recomputed whenever content changes. */
    readingMinutes: {
      type: Number,
      default: 1,
    },

    views: {
      type: Number,
      default: 0,
    },

    seo: {
      metaTitle: { type: String, trim: true, default: "" },
      metaDescription: { type: String, trim: true, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

// The public list is always newest-published first
blogSchema.index({ status: 1, publishedAt: -1 });

/** "Solar Panel Basics!" -> "solar-panel-basics" */
export const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Returns a slug that is free, appending -2, -3 … on collision.
 * `excludeId` lets a post keep its own slug while being edited.
 */
blogSchema.statics.generateUniqueSlug = async function (title, excludeId) {
  const base = slugify(title) || "post";
  let candidate = base;
  let suffix = 2;

  // eslint-disable-next-line no-await-in-loop
  while (
    await this.exists({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

/** ~200 words per minute, floored at 1. */
export const estimateReadingMinutes = (content = "") => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

export default mongoose.model("Blog", blogSchema);
