const redis = require('redis');
const host = process.env.REDIS_HOST;

const redisClient = redis.createClient(host);
console.log('$ REDIS: client connecting to ', host);

redisClient.on('connect', () => {
  console.log('$ REDIS: client connected ')
});

module.exports = redisClient;
