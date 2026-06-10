import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({

  projectName: {
    type: String,
    required: true
  },

  clientName: {
    type: String,
    required: true
  },

  capacity: {
    type: String,
    required: true
  },

  location: {
    type: String,
    required: true
  },

  projectType: {
    type: String,
    enum: [
      "Rooftop",
      "Ground Mounted",
      "Industrial",
      "Residential"
    ],
    default: "Rooftop"
  },

  status: {
    type: String,
    enum: [
      "Pending",
      "Ongoing",
      "Completed"
    ],
    default: "Pending"
  },

  startDate: {
    type: Date
  },

  completionDate: {
    type: Date
  },

  description: {
    type: String
  },

  images: [{
    type: String
  }]

}, {
  timestamps: true
});

const Project = mongoose.model(
  "Project",
  projectSchema
);

export default Project;