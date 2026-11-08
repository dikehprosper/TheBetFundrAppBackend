// One registry so services call providers through a single, replaceable object (tests swap these).
module.exports = {
  mobcash: require('./mobcash.provider'),
  qos: require('./qos.provider'),
  fedapay: require('./fedapay.provider'),
  storage: require('./storage.provider'),
  push: require('./push.provider'),
  moderation: require('./moderation.provider'),
  sports: require('./sports.provider')
}
