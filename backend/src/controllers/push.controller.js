const { saveSubscription, deleteSubscription, VAPID_PUBLIC_KEY } = require('../services/push.service');
const { sendSuccess } = require('../utils/response.utils');

const subscribeHandler = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    const userAgent = req.get('user-agent');
    const sub = await saveSubscription(req.user.id, { endpoint, keys, userAgent });
    sendSuccess(res, 201, 'Push subscription saved', { subscription: sub });
  } catch (e) { next(e); }
};

const unsubscribeHandler = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    const result = await deleteSubscription(req.user.id, endpoint);
    sendSuccess(res, 200, 'Push subscription removed', result);
  } catch (e) { next(e); }
};

const vapidKeyHandler = async (_req, res) => {
  sendSuccess(res, 200, 'VAPID public key', { publicKey: VAPID_PUBLIC_KEY || null });
};

module.exports = { subscribeHandler, unsubscribeHandler, vapidKeyHandler };