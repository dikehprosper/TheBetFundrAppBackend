const Notification = require("../models/notification");
const {
  serverErrorResponse,
  successResponse,
  failedResponse,
} = require("../helpers/response.js");

const getNotifications = async (req) => {
  try {
    const user = req.user();
    const notifications = await Notification.find({ to: user._id });

    return successResponse(res, "Notifications returned", {
      notifications: notifications,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

module.exports = { getNotifications };
