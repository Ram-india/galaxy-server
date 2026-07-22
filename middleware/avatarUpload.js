import { createImageUpload } from "./imageUpload.js";

/** Profile photos, kept out of the project and blog folders. */
export const uploadAvatar = createImageUpload({
  folder: "gps-avatars",
  field: "avatar",
  maxBytes: 2 * 1024 * 1024, // 2 MB — matches the hint in the UI
});

export default uploadAvatar;
