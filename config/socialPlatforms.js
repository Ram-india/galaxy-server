/**
 * Social platforms the site can link to.
 *
 * `canAutoPost` marks the platforms the publisher has an adapter for — the
 * rest are link-only. Mirrored by my-admin/src/constants/socials.js for the UI.
 */
export const SOCIAL_PLATFORMS = [
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://www.linkedin.com/company/your-company",
    canAutoPost: true,
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/yourpage",
    canAutoPost: true,
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://www.instagram.com/yourhandle",
    canAutoPost: false,
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://www.youtube.com/@yourchannel",
    canAutoPost: false,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/919876543210",
    canAutoPost: false,
  },
  {
    key: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/yourhandle",
    canAutoPost: false,
  },
];

export const SOCIAL_PLATFORM_KEYS = SOCIAL_PLATFORMS.map((item) => item.key);

/** Platforms the auto-publisher knows how to post to. */
export const AUTO_POST_PLATFORMS = SOCIAL_PLATFORMS.filter(
  (item) => item.canAutoPost
).map((item) => item.key);
