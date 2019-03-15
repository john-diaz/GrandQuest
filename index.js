/* index.js */

/*
  Import dependencies
*/
const { createServer } = require('http'),
      dotenv = require('dotenv');

/*
Environmental variables
*/
const { NODE_ENV } = process.env;

if (NODE_ENV) {
  dotenv.config({ path: `.env.${NODE_ENV}` });
} else {
  dotenv.config();
}

// import express app and socket server
const expressApp = require('./packages/express');
const socketServer = require('./packages/socketServer');

// create http server with express app
const httpServer = createServer(expressApp);

// socket server listen with the http server
socketServer.listen(httpServer);

console.log('$ SERVER - NODE_ENV =', process.env.NODE_ENV);
console.log('$ SERVER - DB =', process.env.DB_NAME);

const { BCRYPT_SALT, JWT_KEY } = process.env;

if (!BCRYPT_SALT || BCRYPT_SALT == '') throw new Error('Invalid BCRYPT salt in env');
if (!JWT_KEY || JWT_KEY == '') throw new Error('Invalid JWT_KEY in env');

// if (process.env.NODE_ENV === 'test') {
//   redisClient.flushdb();
// }

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT);
});

module.exports = httpServer
