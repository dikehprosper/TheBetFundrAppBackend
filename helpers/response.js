export const successResponse = (res, message, data) => {
  return res.status(200).json({ success: true, message, data });
};

export const failedResponse = (res, message, data) => {
  return res.status(400).json({ success: false, message, data: data });
};

export const serverErrorResponse = (res, error) => {
  return res
    .status(500)
    .json({ success: false, message: "A server error has occured", error });
};
