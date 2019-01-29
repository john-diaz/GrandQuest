const express = require('express');
const JWT = require('jsonwebtoken');
const uuid = require('uuid/v4');
const bcrypt = require('bcrypt');
const async = require('async');
const authMiddleware = require('../middleware/authentication');

const pool = require('../db/client');

const { BCRYPT_SALT, JWT_KEY } = process.env;

const router = new express.Router();

// get user data from token
router.get('/auth', authMiddleware({ required: true }), (req, res) => {
  delete req.user.hashed_password;
  delete req.user.token;

  res.status(200).json({ payload: req.user })
});

// get token from credentials
router.post('/auth', (req, res) => {
  const email    = typeof req.body.email == 'string'
                   && req.body.email.trim().length > 5
                   ? req.body.email.trim().toLowerCase() : false;

  const password = typeof req.body.password == 'string'
                   && req.body.password.trim().length > 5
                   ? req.body.password.trim() : false;

  if (!email || !password) {
    return res.status(422).json({ errors: [ 'Please provide an email and password' ]})
  }

  async.waterfall([
    // find user
    (callback) => pool.query('SELECT * FROM users WHERE email = $1', [email], (err, results) => {
      if (err || !results.rowCount) {
        callback({ status: 404, error: 'Could not find user by provided email' });
      } else {
        callback(null, results.rows[0]);
      }
    }),
    // compare passwords
    (user, callback) => bcrypt.compare(password, user.hashed_password, (err, isValid) => {
      if (err) {
        callback({ status: 401, error: 'Failed to authorize user' });
      } else if (!isValid) {
        callback({ status: 401, error: 'Incorrect password provided' });
      } else {
        callback(null, user);
      }
    }),
    // sign jwt
    (user, callback) => JWT.sign({ email: user.email }, JWT_KEY, { expiresIn: 60 * 60 * 1000 }, (err, jwt_token) => {
      if (err || !jwt_token) {
        callback({ status: 500, error: 'Failed to create token' });
      } else {
        callback(null, user, jwt_token)
      }
    }),
    // set the token to the user in DB
    // TODO: don't update token if there is an existing one.
    (user, jwt_token, callback) => pool.query('UPDATE users SET token = $1 WHERE id = $2', [jwt_token, user.id], (err, results) => {
      if (err) {
        callback({ status: 500, error: 'Failed to save token' });
      } else {
        callback(null, user, jwt_token);
      }
    }),
  ], (err, user, jwt_token) => {
    if (err) {
      return res.status(err.status).json({ errors: [ err.error ] });
    }

    delete user.token;
    delete user.hashed_password;

    res
    .set({
      'Authorization': jwt_token,
      'Access-Control-Expose-Headers': 'Authorization',
    })
    .json({ payload: user });
  });
});

router.delete('/auth/:token', (req, res) => {
  const { token } = req.params;

  pool.query('UPDATE users SET token = null WHERE token = $1 RETURNING token', [token], (err, results) => {
    if (err || !results.rowCount) {
      res.status(404).json({ errors: ['Failed to eliminate token'] });
    } else {
      res.sendStatus(200);
    }
  });
});

// create user from JSON
// TODO: add password validation
router.post('/auth/default', (req, res) => {
  // verify fields are valid
  const email    =  typeof req.body.email == 'string'
                    && /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(req.body.email)
                    ? req.body.email.trim().toLowerCase() : false;
  const username =  typeof req.body.username == 'string'
                    && req.body.username.trim().length >= 5
                    ? req.body.username.trim().toLowerCase() : false;
  const gender   =  typeof req.body.gender == 'string'
                    && (req.body.gender.toLowerCase().trim() === 'male' || req.body.gender.toLowerCase().trim() === 'female')
                    ? req.body.gender.toLowerCase().trim() : false;
  const password =  typeof req.body.password == 'string'
                    && req.body.password.trim().length >= 8
                    // verify password validity here
                    ? req.body.password.trim() : false;

  const errors = [];

  if(!email) {
    errors.push('Please enter a correctly formatted email');
  }
  if (!username) {
    errors.push('Username must be at least 5 characters long');
  }
  if (!gender) {
    errors.push('Gender must be either male of female');
  }
  if (!password) {
    errors.push(`
      Password must be between 8 to 80 characters, 
      contain at least one digit, 
      and upper and lowercase letters and no spaces
    `);
  }

  if (errors.length) {
    return res.status(422).json({ errors, message: errors.join('. ') });
  }

  async.waterfall([
    callback => bcrypt.hash(password, Number(BCRYPT_SALT), (err, hashedPassword) => {
      if (err || !hashedPassword) {
        callback({ status: 500, error: 'Failed to encrypt password' });
      } else {
        callback(null, hashedPassword);
      }
    }),
    (hashedPassword, callback) => JWT.sign({ email }, JWT_KEY, {expiresIn: 60 * 60 * 1000}, (err, jwt_token) => {
      if (err || !jwt_token) {
        callback({ status: 500, error: 'Failed to sign token' });
      } else {
        callback(null, { hashedPassword, jwt_token });
      }
    }),
    (obj, callback) => {
      let { hashedPassword, jwt_token } = obj;

      pool.query(
      'INSERT INTO users (email, username, gender, hashed_password, token) values($1, $2, $3, $4, $5) RETURNING *',
      [email, username, gender, hashedPassword, jwt_token],
      (err, results) => {
        if(err) {
          let detail = 'Failed to create user';

          if (err.constraint == 'users_email_key') {
            detail = 'A user with this email already exists';
          } else if (err.constraint == 'users_username_key') {
            detail = 'A user with this username already exists';
          }

          callback({ status: 500, error: detail })
        } else {
          const user = results.rows[0];

          pool.query('INSERT INTO players (id) values ($1)', [ user.id ], (err) => {
            if (err) throw err;
            callback(null, user);
          });
        }
      });
    },
  ], (err, user) => {
    if (err) {
      return res.status(err.status).json({ errors: [ err.error ] });
    }

    res
    .set({
      'Authorization': user.token,
      'Access-Control-Expose-Headers': 'Authorization',
    });

    delete user.token;
    delete user.hashed_password;

    res.json({ payload: user });
  });
});

module.exports = router;
