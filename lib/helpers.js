const redisClient = require('./redisClient');

let helpers = {}

helpers.cache = {}
helpers.cache.flush = () => {
  redisClient.flushdb((err, res) => {
    if (err || !res) {
      console.log('$ REDIS: FAILED TO FLUSH CACHE => ', err);
    } else {
      console.log('$ REDIS: flushed cache');
    }
  });
}

module.exports = helpers
