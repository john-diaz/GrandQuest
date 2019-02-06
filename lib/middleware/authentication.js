const { JWT_KEY } = process.env;

if (!JWT_KEY || JWT_KEY == '') throw new Error('Missing JWT_KEY env variable');

const pool = require('../db/client');
const JWT = require('jsonwebtoken');
const async = require('async');

module.exports = (options) => (req, res, next) => {
    req.user = null;

    const accessToken = req.get('Authorization');

    if (typeof accessToken !== 'string' || accessToken.trim().length < 0) {
      if (options.required) {
        return res.status(422).json({ errors: ['You must provide an authorization header to continue']})
      } else {
        return next();
      }
    }

    async.waterfall([
      // find the JWT with the email from our DB
      (callback) => pool.query('SELECT * FROM users WHERE token = $1', [accessToken], (err, results) => {
        if (err || !results.rowCount) {
          callback({ status: 401, error: 'Could not find user by this access token'});
        } else {
          callback(null, results.rows[0]);
        }
      }),
      // verify that the DB jwt is valid
      (user, callback) => JWT.verify(user.token, JWT_KEY, (err, payload) => {
        if (err || !payload) {
          // this token is invalid. remove it
          pool.query('UPDATE * FROM users SET token = null WHERE token = $1', [accessToken]);
          callback({ status: 401, error: 'Invalid token'});
        } else {
          callback(null, user);
        }
      }),
    ], (err, user) => {
      if (!err && user) {
        req.user = user;
      } else if (options.required) {
        return res.status(err.status).json({ errors: [err.error] });
      }
      next();
    });
  };
