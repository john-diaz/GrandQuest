const express = require('express');
const JWT = require('jsonwebtoken');
const uuid = require('uuid/v4');
const bcrypt = require('bcrypt');

const pool = require('../db/client');
const redisClient = require('../redisClient');

const { BCRYPT_SALT, JWT_KEY } = process.env;

const router = new express.Router();

// get user data from token
router.get('/auth', (req, res) => {
  const accessToken = req.get('authorization');

  if (typeof accessToken !== 'string' || accessToken.trim().length < 10) {
    return res.status(422).json({ errors: [ 'No accessToken provided' ]});
  }

  JWT.verify(accessToken, JWT_KEY, (err, decoded) => {
    if (err || !decoded) {
      return res.status(401).json({ errors: ['Could not verify access token'] });
    }

    redisClient.get(`accessToken/${decoded.email}`, (err, jwt_token) => {
      if (err || !jwt_token) {
        return res.status(404).json({ errors: ['Could not find access token'] });
      }

      JWT.verify(jwt_token, JWT_KEY, (err, payload) => {
        if (err || !payload) {
          return res.status(401).json({ errors: ['Invalid token'] });
        }

        pool.query('SELECT email, username, gender FROM users WHERE lower(email) = $1', [payload.email], (err, results) => {
          if (err || !results.rowCount) {
            return res.status(404).json({ errors: ['Could not find user by this token'] });
          }

          const user = results.rows[0];

          res.status(200).json({ payload: user });
        });
      });
    });
  });
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

  pool.query('SELECT * FROM users WHERE lower(email) = $1', [email],
    (err, results) => {
      if (err) {
        return res.status(500).json({ errors: ['Something went wrong... Please try again later'] })
      }
      if (!results.rowCount) {
        return res.status(404).json({ errors: [ 'Could not find user by provided email' ]});
      }

      const user = results.rows[0];

      bcrypt.compare(password, user.hashed_password, (err, isValid) => {
        if (err) {
          return res.status(500).json({ errors: [ 'Failed to authorize user' ]});
        }
        if (!isValid) {
          return res.status(401).json({ errors: [ 'Incorrect password' ] });
        }

        redisClient.get(`accessToken/${user.email}`, (err, jwt_token) => {
          // user already has a token
          if (jwt_token) {
            res.set('Authorization', jwt_token).sendStatus(200);
          } else {
            const expiresIn = 60 * 60;

            const jwt_token = JWT.sign(
              { email: user.email },
              JWT_KEY,
              { expiresIn: expiresIn * 1000 }); // one hour expiry

            redisClient.set(`accessToken/${user.email}`, jwt_token, 'EX', expiresIn, (err) => {
              if (err) {
                res.status(500).json({ errors: ['Could not create access token' ] });
              } else {
                res.set('Authorization', jwt_token).set('Expires', expiresIn).sendStatus(201);
              }
            });
          }
        });
      })
    });
});

// create user from JSON
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
                    // verify password topology, characters and topology
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
    errors.push('Password must be at least 8 characters');
  }

  if (errors.length) {
    res.status(422).json({ errors, message: errors.join('. ') });
  } else {
    bcrypt.hash(password, Number(BCRYPT_SALT), (err, hashedPassword) => {
      if (err || !hashedPassword) {
        return res.status(500).json({ errors: [ 'Failed to encrypt password' ]});
      }
      pool.query(
        'INSERT INTO users (email, username, gender, hashed_password) values($1, $2, $3, $4)',
        [email, username, gender, hashedPassword],
        (err) => {
          if(err) {
            res.status(500).json({ errors: ['Could not create user'] });
          } else {
            res.sendStatus(201);
          }
        });
    });
  }
});

module.exports = router;
