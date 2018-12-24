const { JWT_KEY } = process.env;

if (!JWT_KEY || JWT_KEY == '') throw new Error('Missing JWT_KEY env variable');

const pool = require('./db/client');
const redisClient = require('./redisClient');
const JWT = require('jsonwebtoken');
const async = require('async');

const authenticationMiddleware = (req, res, next) => {
  req.user = null;

  const accessToken = req.get('Authorization');
  console.log('authorization = ', accessToken);

  if (typeof accessToken !== 'string' || accessToken.trim().length < 0) {
    return next();
  }
  async.waterfall([
    (callback) => JWT.verify(accessToken, JWT_KEY, (err, decoded) => {
      if (err || !decoded) {
        callback('Could not verify JWT')
      } else {
        callback(null, decoded.email);
      }
    }),
    (email, callback) => redisClient.get(`accessToken/${email}`, (err, jwt_token) => {
      if (err || !jwt_token) {
        callback('No JWT found in datbase');
      } else {
        callback(null, jwt_token);
      }
    }),
    (jwt_token, callback) => JWT.verify(jwt_token, JWT_KEY, (err, decoded) => {
        if (err || !decoded) {
          callback('Invalid JWT');
        } else {
          callback(null, decoded.email)
        }
    }),
    (email, callback) => pool.query('SELECT * FROM users WHERE email = $1', [email], (err, results) => {
      if (err || !results.rowCount) {
        redisClient.del(`accessToken/${email}`);
        return callback(`No user by ${email} found`);
      }

      const user = results.rows[0];
      callback(null, user);
    }),
  ], (err, user) => {
    req.user = (!err && user) ? user : null;
    console.log('req.user ', req.user);
    next();
  });
};

module.exports = () => authenticationMiddleware;

