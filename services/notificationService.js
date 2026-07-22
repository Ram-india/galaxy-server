import Notification from "../models/Notification.js";

/**
 * Creates a notification without ever breaking the calling request.
 *
 * Notifications are a side effect: if writing one fails, the enquiry that
 * triggered it must still succeed, so errors are logged and swallowed.
 */
export const createNotification = async (payload) => {
  try {
    return await Notification.create(payload);
  } catch (error) {
    console.error("Create Notification Error:", error);
    return null;
  }
};

/** Removes every notification pointing at a deleted document. */
export const removeNotificationsForEntity = async (entityId) => {
  try {
    await Notification.deleteMany({ entityId });
  } catch (error) {
    console.error("Delete Notifications Error:", error);
  }
};

/* ------------------------------------------------------------------ enquiry */

export const notifyEnquiryCreated = (enquiry) =>
  createNotification({
    type: "enquiry_created",
    title: "New enquiry received",
    message: `${enquiry.fullName} submitted a ${
      enquiry.projectType || "solar"
    } enquiry from the website.`,
    module: "enquiry",
    entityId: enquiry._id,
    entityModel: "Enquiry",
    link: `/enquiries/${enquiry._id}`,
    meta: {
      customerName: enquiry.fullName,
      phone: enquiry.phone,
      projectType: enquiry.projectType,
      installationType: enquiry.installationType,
    },
  });

export const notifyEnquiryStatusChanged = (enquiry, previousStatus, actorId) => {
  // A conversion is the outcome the team cares about most — give it its own type
  const isConversion = enquiry.status === "Converted";

  return createNotification({
    type: isConversion ? "enquiry_converted" : "enquiry_status_changed",
    title: isConversion ? "Enquiry converted" : "Enquiry status updated",
    message: isConversion
      ? `${enquiry.fullName}'s enquiry was marked as Converted.`
      : `${enquiry.fullName}'s enquiry moved from ${previousStatus} to ${enquiry.status}.`,
    module: "enquiry",
    entityId: enquiry._id,
    entityModel: "Enquiry",
    link: `/enquiries/${enquiry._id}`,
    meta: {
      customerName: enquiry.fullName,
      previousStatus,
      newStatus: enquiry.status,
    },
    actor: actorId || null,
  });
};
