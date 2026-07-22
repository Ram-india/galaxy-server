import mongoose from "mongoose";

export const JOB_STATUS = { ACTIVE: "Active", CLOSED: "Closed" };

export const JOB_TYPES = [
  "Full Time",
  "Part Time",
  "Contract",
  "Internship",
];

/**
 * A careers listing. `status: Active` renders as open on the website and
 * produces a Google-indexable JobPosting schema.
 */
const jobSchema = new mongoose.Schema(
  {
    position: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: "" },
    experience: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },

    type: { type: String, enum: JOB_TYPES, default: "Full Time" },

    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.ACTIVE,
      index: true,
    },

    description: { type: String, trim: true, default: "" },

    /** Feeds datePosted in the JobPosting schema. */
    posted: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
