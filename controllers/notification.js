const Notification = require("../models/notification");
const getNotifications = async (req) => {
  try {
    const user = req.user();
    const notifications = await Notification.find({ to: user._id });

    return successResponse(res, "Notifications returned", {
      notifications: notifications,
    });
  } catch (err) {
    return failureResponse(res, err);
  }
};

module.exports = { getNotifications };
