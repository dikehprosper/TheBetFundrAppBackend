/* eslint-disable no-undef */
const successResponse = (res, message, data) => {
  return res.status(200).json({ success: true, message, data });
};

const failedResponse = (res, message, data) => {
  return res.status(400).json({ success: false, message, data: data });
};

const serverErrorResponse = (res, error) => {
  return res
    .status(500)
    .json({ success: false, message: "A server error has occured", error });
};

module.exports = { successResponse, failedResponse, serverErrorResponse };
