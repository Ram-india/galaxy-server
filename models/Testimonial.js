import mongoose from "mongoose";

/** A client quote shown on the website. */
const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    /** "Factory Owner, Coimbatore" — shown under the name. */
    role: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },

    message: { type: String, required: true, trim: true },

    rating: { type: Number, min: 1, max: 5, default: 5 },

    avatar: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    // Lower numbers show first
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Testimonial", testimonialSchema);
