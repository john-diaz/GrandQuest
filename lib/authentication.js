const { JWT_KEY } = process.env;

if (!JWT_KEY || JWT_KEY == '') throw new Error('Missing JWT_KEY env variable');

const pool = require('./db/client');
const redisClient = require('./redisClient');
const JWT = require('jsonwebtoken');

const authenticationMiddleware = (req, res, next) => {
  req.user = null;

  const accessToken = req.get('Authorization');

  if (typeof accessToken !== 'string' || accessToken.trim().length < 0) {
    next();
  } else {
    redisClient.get(`accessToken/${accessToken}`, (err, jwt_token) => {
      if (!jwt_token || err) {
        return next();
      }

      JWT.verify(jwt_token, JWT_KEY, (err, decoded) => {
        if (err) {
          next();
        } else if (!decoded || !decoded.id) {
          redisClient.del(`accessToken/${accessToken}`, () => {
            next();
          });
        } else {
          pool.query('SELECT * FROM user WHERE id = $1', [decoded.id], (err, results) => {
            if (err || !results.rowCount) {
              return next();
            }

            const user = results.rows[0];

            req.user = user;

            // refresh the token here!

            next();
          });
        }
      });
    });
  }
};

module.exports = () => authenticationMiddleware;

