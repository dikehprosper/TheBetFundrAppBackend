/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const EventEmitter = require('events');
class PaymentEventEmitter extends EventEmitter {}
const paymentEvents = new PaymentEventEmitter();

module.exports = paymentEvents;