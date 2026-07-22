import Enquiry from "../models/Enquiry.js";
import {
  notifyEnquiryCreated,
  notifyEnquiryStatusChanged,
  removeNotificationsForEntity,
} from "../services/notificationService.js";

export const createEnquiry = async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const enquiry = await Enquiry.create(req.body);

    // Alert the admin panel — never blocks the website response
    await notifyEnquiryCreated(enquiry);

    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      enquiry,
    });
  } catch (error) {
    console.error("Create Enquiry Error:");
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// get all enquiries

export const getEnquiries = async (req, res)=> {
  try{
    const enquires = await Enquiry.find().sort({ createdAt: -1 });
    res.status(200).json(enquires);
  } catch (error) {
    console.error("Get Enquiries Error:", error);
  
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// get single enquiry

export const getEnquiry = async (req,res)=>{
  try{
    const enquiry = await Enquiry.findById(req.params.id);
    if(!enquiry){
      return res.status(404).json({
        message: "Enquiry not found"
      });
    }
    res.status(200).json(enquiry);
  } catch(error){
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// update enquiry (admin panel - mainly used for status changes)

export const updateEnquiry = async (req, res) => {
  try {
    // Only allow fields the admin is meant to edit
    const { status, requirement } = req.body;
    const updates = {};

    if (status !== undefined) updates.status = status;
    if (requirement !== undefined) updates.requirement = requirement;

    // Read first so the notification can report the previous status
    const existing = await Enquiry.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const previousStatus = existing.status;

    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    // Only notify on a real transition, not on a no-op save
    if (status !== undefined && status !== previousStatus) {
      await notifyEnquiryStatusChanged(enquiry, previousStatus, req.admin?.id);
    }

    res.status(200).json(enquiry);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// delete enquiry

export const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    // Drop notifications that would now link to a missing enquiry
    await removeNotificationsForEntity(enquiry._id);

    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};