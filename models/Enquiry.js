import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    projectType: {
      type: String,
      enum: [
        "Residential",
        "Commercial",
        "Industrial",
        "Agriculture",
        "Government",
      ],
    },

    installationType: {
      type: String,
 
      enum: [
        "On Grid",
        "Off Grid",
        "Hybrid",
        "Solar Water Pump",
        "Street Light",
        "Solar Water Heater",
      ],
    },

    requirement: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Quotation Sent",
        "Converted",
        "Closed",
      ],
      default: "New",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Enquiry", enquirySchema);