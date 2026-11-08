const Joi = require('joi')
const { AppError } = require('../utils/handlers')

/** Run a Joi schema against body / query / params and replace them with the cleaned values. */
const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue
    const { value, error } = schemas[part].validate(req[part] || {}, { abortEarly: false, stripUnknown: true, convert: true })
    if (error) {
      const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }))
      return next(new AppError(422, 'Validation failed', { code: 422, details: errors }))
    }
    Object.defineProperty(req, part, { value, writable: true, configurable: true, enumerable: true })
  }
  return next()
}

// ---------- building blocks ----------
// Syntax only. Joi's default also checks a bundled TLD list, which wrongly rejects real addresses on newer TLDs.
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254)
const password = Joi.string().min(6).max(128)
const pin = Joi.string().pattern(/^\d{4,8}$/).message('PIN must be 4 to 8 digits')
const code = Joi.string().pattern(/^\d{6}$/).message('Code must be 6 digits')
const uuid = Joi.string().guid({ version: 'uuidv4' })
const betId = Joi.string().trim().pattern(/^[A-Za-z0-9_-]{1,30}$/)
const phone = Joi.alternatives(Joi.string().pattern(/^\d{6,15}$/), Joi.number().integer().positive()).custom((v) => String(v))
const strictNumber = Joi.number().strict().positive()
const decimalString = Joi.string().pattern(/^\d{1,14}(\.\d{1,2})?$/)
const amount = Joi.alternatives().try(strictNumber, decimalString).required()
const network = Joi.string().trim().pattern(/^[A-Za-z_]{2,20}$/).required()
const text = (max) => Joi.string().trim().max(max)

const schemas = {
  register: { body: Joi.object({
    fullname: Joi.string().trim().min(2).max(100).required(), email: email.required(), password: password.required(),
    betId: betId.allow('', null), number: phone.allow('', null), referrerId: text(50).allow('', null)
  }) },
  login: { body: Joi.object({ email: email.required(), password: Joi.string().max(128).required() }) },
  emailOnly: { body: Joi.object({ email: email.required() }) },
  checkResetCode: { body: Joi.object({ email: email.required(), pin: code.required() }) },
  resetPasswordWithCode: { body: Joi.object({ email: email.required(), pin: code.required(), password: password.required() }) },
  changePassword: { body: Joi.object({ password: Joi.string().max(128).required(), newPassword: password.required() }) },
  setPin: { body: Joi.object({ pin: pin.required() }) },
  verifyPin: { body: Joi.object({ pin: Joi.string().max(12).required() }) },
  changePin: { body: Joi.object({ pin: pin.required(), code: code.required() }) },
  checkPinCode: { body: Joi.object({ pin: code.required() }) },
  getUser: { body: Joi.object({ expoPushToken: text(200).allow('', null) }) },
  colorScheme: { body: Joi.object({ colorScheme: Joi.number().integer().min(0).max(2).required() }) },
  setTag: { body: Joi.object({ tag: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{3,30}$/).required() }) },
  details: { body: Joi.object({ fullname: Joi.string().trim().min(2).max(100), number: phone, betId }) },
  deleteAccount: { body: Joi.object({ password: Joi.string().max(128).required() }) },
  search: { body: Joi.object({ query: Joi.string().trim().min(1).max(50).required() }) },

  deposit: { body: Joi.object({
    betId: betId.required(), amount, momoNumber: phone.required(), network,
    service: text(30).allow('', null), momoName: text(100).allow('', null), fullname: text(100).allow('', null),
    bonusBalance: Joi.number().min(0).allow(null), idempotencyKey: text(100)
  }) },
  walletDeposit: { body: Joi.object({ betId: betId.required(), amount, service: text(30).allow('', null), idempotencyKey: text(100) }) },
  publicDeposit: { body: Joi.object({
    email: email.required(), betId: betId.required(), amount, momoNumber: phone.required(), network,
    service: text(30).allow('', null), momoName: text(100).allow('', null), fullname: text(100).allow('', null), idempotencyKey: text(100)
  }) },
  qrDeposit: { body: Joi.object({
    qrId: uuid.required(), momoNumber: phone.required(), network,
    service: text(30).allow('', null), momoName: text(100).allow('', null), fullname: text(100).allow('', null), idempotencyKey: text(100)
  }) },
  withdrawal: { body: Joi.object({
    amount: Joi.alternatives().try(strictNumber, decimalString),
    betId: betId.allow('', null), withdrawalCode: Joi.string().trim().max(40).allow('', null), momoNumber: phone.required(),
    service: text(30).allow('', null), bonusBalance: Joi.number().min(0).allow(null), idempotencyKey: text(100)
  }) },
  walletSend: { body: Joi.object({
    recipientId: uuid, recipientid: uuid, amount, idempotencyKey: text(100)
  }).or('recipientId', 'recipientid') },
  qrGenerate: { body: Joi.object({ betId: betId.required(), amount, service: text(30).allow('', null) }) },
  qrCheck: { body: Joi.object({ qrId: uuid.required() }) },
  qosCallback: { body: Joi.object({ transref: text(60), reference: text(60), status: text(30), responsemsg: text(30) }).or('transref', 'reference').unknown(true) },
  fedapayDeposit: { body: Joi.object({
    betId: betId.required(), amount, momoNumber: phone.required(), network,
    service: text(30).allow('', null), bonusBalance: Joi.number().min(0).allow(null), idempotencyKey: text(100)
  }) },

  idQuery: (field) => ({ query: Joi.object({ [field]: uuid.required() }) }),
  postCreate: { body: Joi.object({ body: text(5000).allow('', null) }) },
  postId: { body: Joi.object({ postId: uuid.required() }) },
  postUpdate: { body: Joi.object({ postId: uuid.required(), postUpdate: text(5000).required() }) },
  comment: { body: Joi.object({ postId: uuid.required(), comment: text(2000).min(1).required() }) },
  commentEdit: { query: Joi.object({ commentId: uuid.required() }), body: Joi.object({ description: text(2000).min(1).required() }) },
  commentDelete: { query: Joi.object({ commentId: uuid.required(), postId: uuid }) },
  userIdQuery: { query: Joi.object({ userId: uuid, limit: Joi.number().integer().min(1).max(100), offset: Joi.number().integer().min(0) }) },
  page: { query: Joi.object({ limit: Joi.number().integer().min(1).max(100), offset: Joi.number().integer().min(0) }) },
  follow: { body: Joi.object({ userId: uuid.required() }) },
  pushToken: { body: Joi.object({ expoPushToken: text(200).required() }) },

  league: { body: Joi.object({ league: text(100).required() }) },
  team: { body: Joi.object({ team: text(100).required() }) },
  idBody: { body: Joi.object({ id: uuid.required() }) },
  match: { body: Joi.object({
    team1: text(100).required(), team1Flag: text(500).allow('', null), team2: text(100).required(), team2Flag: text(500).allow('', null),
    league: text(100).required(), leagueFlag: text(500).allow('', null), tip: text(100).required(),
    time: text(20).required(), status: text(30).required(), matchDate: Joi.date().iso()
  }) },
  matchUpdate: { body: Joi.object({
    id: uuid.required(), team1: text(100), team1Flag: text(500).allow('', null), team2: text(100), team2Flag: text(500).allow('', null),
    league: text(100), leagueFlag: text(500).allow('', null), tip: text(100), time: text(20), status: text(30), matchDate: Joi.date().iso()
  }) }
}

module.exports = { validate, schemas, Joi }
