import HeroSlide from "../models/HeroSlide.js";
import Job, { JOB_STATUS } from "../models/Job.js";
import Testimonial from "../models/Testimonial.js";
import Client from "../models/Client.js";

/** Reads a Cloudinary upload regardless of storage-adapter version. */
const readUploadedImage = (file) => ({
  image: file.secure_url || file.url || file.path || "",
  imagePublicId: file.public_id || file.filename || "",
});

/* ------------------------------------------------------------ hero slides */

/** GET /api/content/slides/public — active slides, in order. */
export const getPublicSlides = async (req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });

    res.status(200).json(slides);
  } catch (error) {
    console.error("Get Public Slides Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/content/slides — every slide, for the admin list. */
export const getSlides = async (req, res) => {
  try {
    const slides = await HeroSlide.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json(slides);
  } catch (error) {
    console.error("Get Slides Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/content/slides */
export const createSlide = async (req, res) => {
  try {
    const { title, subtitle, ctaLabel, ctaHref, isActive } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: "A title is required." });
    }

    // New slides go to the end of the carousel
    const last = await HeroSlide.findOne().sort({ order: -1 });

    const slide = await HeroSlide.create({
      title: title.trim(),
      subtitle: subtitle || "",
      ctaLabel: ctaLabel || "",
      ctaHref: ctaHref || "",
      isActive: isActive === undefined ? true : isActive === "true" || isActive === true,
      order: last ? last.order + 1 : 0,
      ...(req.file ? readUploadedImage(req.file) : {}),
    });

    res.status(201).json({ message: "Slide added", slide });
  } catch (error) {
    console.error("Create Slide Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/content/slides/:id */
export const updateSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    const { title, subtitle, ctaLabel, ctaHref, isActive } = req.body;

    if (title !== undefined) slide.title = title.trim();
    if (subtitle !== undefined) slide.subtitle = subtitle;
    if (ctaLabel !== undefined) slide.ctaLabel = ctaLabel;
    if (ctaHref !== undefined) slide.ctaHref = ctaHref;
    if (isActive !== undefined) {
      slide.isActive = isActive === "true" || isActive === true;
    }

    if (req.file) Object.assign(slide, readUploadedImage(req.file));

    await slide.save();

    res.status(200).json({ message: "Slide updated", slide });
  } catch (error) {
    console.error("Update Slide Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PATCH /api/content/slides/reorder — body: { ids: [...] } in display order. */
export const reorderSlides = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: "Expected an array of ids." });
    }

    await Promise.all(
      ids.map((id, index) =>
        HeroSlide.updateOne({ _id: id }, { $set: { order: index } })
      )
    );

    const slides = await HeroSlide.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json({ message: "Order saved", slides });
  } catch (error) {
    console.error("Reorder Slides Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/content/slides/:id */
export const deleteSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findByIdAndDelete(req.params.id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    res.status(200).json({ success: true, message: "Slide deleted" });
  } catch (error) {
    console.error("Delete Slide Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* -------------------------------------------------------------------- jobs */

/** GET /api/content/jobs/public — open roles first, newest first. */
export const getPublicJobs = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ status: 1, posted: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Get Public Jobs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/content/jobs */
export const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ posted: -1 });

    const stats = {
      total: jobs.length,
      active: jobs.filter((job) => job.status === JOB_STATUS.ACTIVE).length,
      closed: jobs.filter((job) => job.status === JOB_STATUS.CLOSED).length,
    };

    res.status(200).json({ jobs, stats });
  } catch (error) {
    console.error("Get Jobs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/content/jobs */
export const createJob = async (req, res) => {
  try {
    if (!req.body.position?.trim()) {
      return res.status(400).json({ message: "A position title is required." });
    }

    const job = await Job.create({
      ...req.body,
      position: req.body.position.trim(),
      posted: req.body.posted || new Date(),
    });

    res.status(201).json({ message: "Job posted", job });
  } catch (error) {
    console.error("Create Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/content/jobs/:id */
export const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!job) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ message: "Job updated", job });
  } catch (error) {
    console.error("Update Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/content/jobs/:id */
export const deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ success: true, message: "Job deleted" });
  } catch (error) {
    console.error("Delete Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ------------------------------------------------------------ testimonials */

/** GET /api/content/testimonials/public — active quotes, in order. */
export const getPublicTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });

    res.status(200).json(testimonials);
  } catch (error) {
    console.error("Get Public Testimonials Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/content/testimonials */
export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({
      order: 1,
      createdAt: 1,
    });

    res.status(200).json(testimonials);
  } catch (error) {
    console.error("Get Testimonials Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/content/testimonials */
export const createTestimonial = async (req, res) => {
  try {
    const { name, message } = req.body;

    if (!name?.trim() || !message?.trim()) {
      return res
        .status(400)
        .json({ message: "A client name and their quote are both required." });
    }

    // New quotes go to the end of the list
    const last = await Testimonial.findOne().sort({ order: -1 });

    const testimonial = await Testimonial.create({
      ...req.body,
      name: name.trim(),
      message: message.trim(),
      rating: Number(req.body.rating) || 5,
      isActive:
        req.body.isActive === undefined
          ? true
          : req.body.isActive === "true" || req.body.isActive === true,
      order: last ? last.order + 1 : 0,
      ...(req.file
        ? {
            avatar: readUploadedImage(req.file).image,
            avatarPublicId: readUploadedImage(req.file).imagePublicId,
          }
        : {}),
    });

    res.status(201).json({ message: "Testimonial added", testimonial });
  } catch (error) {
    console.error("Create Testimonial Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/content/testimonials/:id */
export const updateTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    const { name, role, company, message, rating, isActive } = req.body;

    if (name !== undefined) testimonial.name = name.trim();
    if (role !== undefined) testimonial.role = role;
    if (company !== undefined) testimonial.company = company;
    if (message !== undefined) testimonial.message = message.trim();
    if (rating !== undefined) testimonial.rating = Number(rating) || 5;
    if (isActive !== undefined) {
      testimonial.isActive = isActive === "true" || isActive === true;
    }

    if (req.file) {
      const uploaded = readUploadedImage(req.file);
      testimonial.avatar = uploaded.image;
      testimonial.avatarPublicId = uploaded.imagePublicId;
    }

    await testimonial.save();

    res.status(200).json({ message: "Testimonial updated", testimonial });
  } catch (error) {
    console.error("Update Testimonial Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PATCH /api/content/testimonials/reorder — body: { ids: [...] } in order. */
export const reorderTestimonials = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: "Expected an array of ids." });
    }

    await Promise.all(
      ids.map((id, index) =>
        Testimonial.updateOne({ _id: id }, { $set: { order: index } })
      )
    );

    const testimonials = await Testimonial.find().sort({ order: 1 });
    res.status(200).json({ message: "Order saved", testimonials });
  } catch (error) {
    console.error("Reorder Testimonials Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/content/testimonials/:id */
export const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    res.status(200).json({ success: true, message: "Testimonial deleted" });
  } catch (error) {
    console.error("Delete Testimonial Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* -------------------------------------------------------------- clients */

/** GET /api/content/clients/public — active client logos, in order. */
export const getPublicClients = async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });

    res.status(200).json(clients);
  } catch (error) {
    console.error("Get Public Clients Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/content/clients */
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ order: 1, createdAt: 1 });
    res.status(200).json(clients);
  } catch (error) {
    console.error("Get Clients Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/content/clients */
export const createClient = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "A client name is required." });
    }

    // A logo makes the strip meaningful, so require one on create
    if (!req.file) {
      return res.status(400).json({ message: "Upload the client's logo." });
    }

    // New clients go to the end of the strip
    const last = await Client.findOne().sort({ order: -1 });
    const uploaded = readUploadedImage(req.file);

    const client = await Client.create({
      name: name.trim(),
      website: req.body.website || "",
      isActive:
        req.body.isActive === undefined
          ? true
          : req.body.isActive === "true" || req.body.isActive === true,
      order: last ? last.order + 1 : 0,
      logo: uploaded.image,
      logoPublicId: uploaded.imagePublicId,
    });

    res.status(201).json({ message: "Client added", client });
  } catch (error) {
    console.error("Create Client Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/content/clients/:id */
export const updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const { name, website, isActive } = req.body;

    if (name !== undefined) client.name = name.trim();
    if (website !== undefined) client.website = website;
    if (isActive !== undefined) {
      client.isActive = isActive === "true" || isActive === true;
    }

    if (req.file) {
      const uploaded = readUploadedImage(req.file);
      client.logo = uploaded.image;
      client.logoPublicId = uploaded.imagePublicId;
    }

    await client.save();

    res.status(200).json({ message: "Client updated", client });
  } catch (error) {
    console.error("Update Client Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PATCH /api/content/clients/reorder — body: { ids: [...] } in display order. */
export const reorderClients = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: "Expected an array of ids." });
    }

    await Promise.all(
      ids.map((id, index) =>
        Client.updateOne({ _id: id }, { $set: { order: index } })
      )
    );

    const clients = await Client.find().sort({ order: 1 });
    res.status(200).json({ message: "Order saved", clients });
  } catch (error) {
    console.error("Reorder Clients Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/content/clients/:id */
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    res.status(200).json({ success: true, message: "Client deleted" });
  } catch (error) {
    console.error("Delete Client Error:", error);
    res.status(500).json({ message: error.message });
  }
};
