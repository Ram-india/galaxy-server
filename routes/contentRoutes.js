import express from "express";

import {
  getPublicSlides,
  getSlides,
  createSlide,
  updateSlide,
  reorderSlides,
  deleteSlide,
  getPublicJobs,
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  getPublicTestimonials,
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  reorderTestimonials,
  deleteTestimonial,
  getPublicClients,
  getClients,
  createClient,
  updateClient,
  reorderClients,
  deleteClient,
} from "../controller/contentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import requirePermission from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";
import { createImageUpload } from "../middleware/imageUpload.js";

const router = express.Router();

const uploadAvatarImage = createImageUpload({
  folder: "gps-testimonials",
  field: "avatar",
  maxBytes: 2 * 1024 * 1024,
});

const uploadSlideImage = createImageUpload({
  folder: "gps-slides",
  field: "image",
  maxBytes: 4 * 1024 * 1024,
});

const uploadClientLogo = createImageUpload({
  folder: "gps-clients",
  field: "logo",
  maxBytes: 2 * 1024 * 1024,
});

/* ------------------------------------------------------------------ public */

router.get("/slides/public", getPublicSlides);
router.get("/jobs/public", getPublicJobs);
router.get("/testimonials/public", getPublicTestimonials);
router.get("/clients/public", getPublicClients);

/* --------------------------------------------------------------- protected */

router.use(authMiddleware);

// Website content is governed by the same permission as the rest of settings
const canManage = requirePermission(PERMISSIONS.SETTINGS_MANAGE);

router.get("/slides", canManage, getSlides);
router.post("/slides", canManage, uploadSlideImage, createSlide);
// Declared before "/:id" so "reorder" is not read as an id
router.patch("/slides/reorder", canManage, reorderSlides);
router.put("/slides/:id", canManage, uploadSlideImage, updateSlide);
router.delete("/slides/:id", canManage, deleteSlide);

router.get("/jobs", canManage, getJobs);
router.post("/jobs", canManage, createJob);
router.put("/jobs/:id", canManage, updateJob);
router.delete("/jobs/:id", canManage, deleteJob);

router.get("/testimonials", canManage, getTestimonials);
router.post("/testimonials", canManage, uploadAvatarImage, createTestimonial);
// Declared before "/:id" so "reorder" is not read as an id
router.patch("/testimonials/reorder", canManage, reorderTestimonials);
router.put("/testimonials/:id", canManage, uploadAvatarImage, updateTestimonial);
router.delete("/testimonials/:id", canManage, deleteTestimonial);

router.get("/clients", canManage, getClients);
router.post("/clients", canManage, uploadClientLogo, createClient);
// Declared before "/:id" so "reorder" is not read as an id
router.patch("/clients/reorder", canManage, reorderClients);
router.put("/clients/:id", canManage, uploadClientLogo, updateClient);
router.delete("/clients/:id", canManage, deleteClient);

export default router;
