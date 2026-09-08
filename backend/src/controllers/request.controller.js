const {
  createRequest,
  getRequests,
  updateRequestStatus,
  sharePhone,
  deleteRequest,
} = require('../services/request.service');
const { sendSuccess } = require('../utils/response.utils');

const createRequestHandler = async (req, res, next) => {
  try {
    const io      = req.app.get('io');
    const request = await createRequest(req.user.id, req.user.domain, req.body.rideId, io);
    sendSuccess(res, 201, 'Ride request sent successfully', { request });
  } catch (e) { next(e); }
};

const getRequestsHandler = async (req, res, next) => {
  try {
    const result = await getRequests(req.user.id);
    sendSuccess(res, 200, 'Requests fetched', result);
  } catch (e) { next(e); }
};

const updateRequestHandler = async (req, res, next) => {
  try {
    const io      = req.app.get('io');
    const request = await updateRequestStatus(req.params.id, req.user.id, req.body.status, io);
    sendSuccess(res, 200, `Request ${req.body.status.toLowerCase()} successfully`, { request });
  } catch (e) { next(e); }
};

const sharePhoneHandler = async (req, res, next) => {
  try {
    const result = await sharePhone(req.params.id, req.user.id);
    sendSuccess(res, 200, result.message, result);
  } catch (e) { next(e); }
};

const deleteRequestHandler = async (req, res, next) => {
  try {
    const result = await deleteRequest(req.params.id, req.user.id);
    sendSuccess(res, 200, result.message, result);
  } catch (e) { next(e); }
};

module.exports = {
  createRequestHandler,
  getRequestsHandler,
  updateRequestHandler,
  sharePhoneHandler,
  deleteRequestHandler,
};
