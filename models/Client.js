import mongoose from "mongoose";

/** A client logo shown in the homepage "Our Clients" strip. */
const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    logo: { type: String, default: "" },
    logoPublicId: { type: String, default: "" },

    /** Optional outbound link to the client's own website. */
    website: { type: String, trim: true, default: "" },

    // Lower numbers show first
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Client", clientSchema);
