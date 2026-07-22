import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import pkg from "multer-storage-cloudinary";

const CloudinaryStorage = pkg.default || pkg;

/**
 * Builds a single-image upload middleware backed by Cloudinary.
 *
 * Each feature gets its own folder so avatars, project galleries and blog
 * covers stay separated. A rejected upload answers with a clear 400 rather
 * than falling through to the generic 500 handler.
 *
 * @param {Object}  options
 * @param {string}  options.folder    Cloudinary folder, e.g. "gps-blogs"
 * @param {string}  options.field     multipart field name
 * @param {number}  options.maxBytes  size limit
 */
export const createImageUpload = ({ folder, field, maxBytes }) => {
  const upload = multer({
    storage: CloudinaryStorage({
      cloudinary,
      params: { folder, resource_type: "image" },
    }),
    limits: { fileSize: maxBytes },
    // The client checks this too, but the client is not the one to trust
    fileFilter: (req, file, cb) => {
      if (file.mimetype?.startsWith("image/")) return cb(null, true);
      cb(new Error("Only image files are allowed."));
    },
  });

  return (req, res, next) =>
    upload.single(field)(req, res, (error) => {
      if (!error) return next();

      const megabytes = Math.round(maxBytes / (1024 * 1024));
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `That image is larger than ${megabytes} MB. Please choose a smaller one.`
          : error.message || "Could not process that image.";

      return res.status(400).json({ message });
    });
};

/**
 * Reads the uploaded file's URL and id.
 *
 * multer-storage-cloudinary v2 returns secure_url/public_id while v4 returns
 * path/filename — read both so a package upgrade cannot silently blank images.
 */
export const readUploadedImage = (file) => ({
  url: file?.secure_url || file?.url || file?.path || "",
  publicId: file?.public_id || file?.filename || "",
});

export default createImageUpload;
