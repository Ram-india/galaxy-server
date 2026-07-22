import mongoose from "mongoose";

/** A slide in the homepage hero carousel. */
const heroSlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: "" },

    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    /** Optional call to action rendered over the slide. */
    ctaLabel: { type: String, trim: true, default: "" },
    ctaHref: { type: String, trim: true, default: "" },

    // Drives carousel order; lower numbers show first
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("HeroSlide", heroSlideSchema);
