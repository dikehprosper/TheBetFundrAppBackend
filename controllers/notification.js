const Notification = require("../models/notification");
const {
  serverErrorResponse,
  successResponse,
  failedResponse,
} = require("../helpers/response.js");

const getNotifications = async (req, res) => {
  try {
    const user = req.user();
    const notifications = await Notification.find({ to: user._id }).populate([
      "to",
      "from",
      "post",
    ]);

    return successResponse(res, "Notifications returned", {
      notifications: notifications,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

module.exports = { getNotifications };
