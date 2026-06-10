import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import pkg from "multer-storage-cloudinary";

const CloudinaryStorage = pkg.default || pkg;

// Use multer-storage-cloudinary as a factory and allow images and videos
const storage = CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gps-projects",
    resource_type: "auto",
  },
});

const upload = multer({ storage });

export default upload;