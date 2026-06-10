import Project from "../models/Projects.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

// Upload files to Cloudinary (handles files already uploaded by storage, local files, buffers, or remote URLs)
const uploadImagesToCloudinary = async (files) => {
  const imageURLs = [];

  for (const file of files) {
    try {
      // If storage already uploaded to Cloudinary (multer-storage-cloudinary), file.path is usually a remote url
      if (file.path && /^https?:\/\//.test(file.path)) {
        imageURLs.push(file.path);
        continue;
      }

      // Some storages return secure_url
      if (file.secure_url) {
        imageURLs.push(file.secure_url);
        continue;
      }

      // Some storages (s3) expose location
      if (file.location) {
        imageURLs.push(file.location);
        continue;
      }

      // If file.buffer is present (memory storage), upload via upload_stream
      if (file.buffer) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "gps-projects", resource_type: file.mimetype && file.mimetype.startsWith("video") ? "video" : "image" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );

          stream.end(file.buffer);
        });

        if (result?.secure_url) imageURLs.push(result.secure_url);
        continue;
      }

      // If file.path exists and is a local file path, upload it
      if (file.path) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "gps-projects",
          resource_type: file.mimetype && file.mimetype.startsWith("video") ? "video" : "image",
        });

        if (result?.secure_url) imageURLs.push(result.secure_url);

        // Delete local file after upload if exists
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (e) {
          // ignore unlink errors
        }

        continue;
      }

      // Fallback: if file has a url-like field
      const url = file.url || file.uri || file.filename;
      if (url && typeof url === "string") {
        imageURLs.push(url);
        continue;
      }
    } catch (err) {
      console.error("uploadImagesToCloudinary error for file:", file, err);
      // skip file on error
    }
  }

  return imageURLs;
};

// CREATE PROJECT
export const createProject = async (req, res) => {
  try {
    const {
      projectName,
      clientName,
      capacity,
      location,
      projectType,
      status,
      description,
      startDate,
      completionDate,
    } = req.body;

    const images = req.files?.length
      ? await uploadImagesToCloudinary(req.files)
      : [];

    const project = await Project.create({
      projectName,
      clientName,
      capacity,
      location,
      projectType,
      status,
      description,
      startDate,
      completionDate,
      images,
    });

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

// GET ALL PROJECTS
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 });

    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET SINGLE PROJECT
export const getProject = async (req, res) => {
  try {
    const project = await Project.findById(
      req.params.id
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// UPDATE PROJECT
export const updateProject = async (req, res) => {
  try {
    const updatedData = {
      ...req.body,
    };

    // Upload any newly provided files and preserve existing images
    const uploadedImages = req.files?.length
      ? await uploadImagesToCloudinary(req.files)
      : [];

    // existingImages may be sent as multiple form fields (array) or a single string
    let existing = [];
    if (req.body?.existingImages) {
      if (Array.isArray(req.body.existingImages)) {
        existing = req.body.existingImages;
      } else {
        try {
          existing = JSON.parse(req.body.existingImages);
        } catch (e) {
          existing = [req.body.existingImages];
        }
      }
    }

    // Handle removedImages sent from the client
    let removed = [];
    if (req.body?.removedImages) {
      if (Array.isArray(req.body.removedImages)) {
        removed = req.body.removedImages;
      } else {
        try {
          removed = JSON.parse(req.body.removedImages);
        } catch (e) {
          removed = [req.body.removedImages];
        }
      }
    }

    // Delete removed images from Cloudinary (if possible) and exclude them
    const deleteFromCloudinary = async (url) => {
      try {
        // extract public_id from Cloudinary URL
        const m = url.match(/\/upload\/(?:v\d+\/)?([^?#.]+)\.[^?#]+(?:[?#].*)?$/);
        const publicId = m ? m[1] : null;
        if (publicId) {
          await new Promise((resolve, reject) => {
            cloudinary.v2.uploader.destroy(publicId, { invalidate: true }, (err, result) => {
              if (err) return reject(err);
              resolve(result);
            });
          });
        }
      } catch (e) {
        console.warn('Failed to delete image from Cloudinary', url, e.message);
      }
    };

    if (removed.length) {
      await Promise.all(removed.map((url) => deleteFromCloudinary(url)));
    }

    // Merge preserved existing URLs (excluding removed) with newly uploaded ones
    const preserved = existing.filter((u) => !removed.includes(u));
    if (uploadedImages.length || preserved.length) {
      updatedData.images = [...preserved, ...uploadedImages].filter(Boolean);
    }

    const project =
      await Project.findByIdAndUpdate(
        req.params.id,
        updatedData,
        {
          new: true,
        }
      );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    res.status(200).json({
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE PROJECT
export const deleteProject = async (req, res) => {
  try {
    const project =
      await Project.findByIdAndDelete(
        req.params.id
      );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    res.status(200).json({
      message: "Project deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};