
const express = require('express');
const app = express();
const server = require('http').Server(app);

const { NODE_ENV } = process.env;

if (NODE_ENV) {
  require('dotenv').config({path: '.env.' + NODE_ENV});
} else {
  require('dotenv').config();
}

console.log('$ SERVER - NODE_ENV =', process.env.NODE_ENV);
console.log('$ SERVER - DB =', process.env.DB_NAME);

const { BCRYPT_SALT, JWT_KEY } = process.env;

if (!BCRYPT_SALT || BCRYPT_SALT == '') throw new Error('Invalid BCRYPT salt in env');
if (!JWT_KEY || JWT_KEY == '') throw new Error('Invalid JWT_KEY in env');

const redisClient = require('./lib/redisClient');

if (process.env.NODE_ENV === 'test') {
  redisClient.flushdb();
}

const cors = require('cors');
// enable CORS
if (process.env.NODE_ENV == 'development') {
  app.use(cors({
    origin: 'http://localhost:8080',
  }));
}

// parse json body
app.use(express.json());

// authentication
const authentication = require('./lib/middleware/authentication');

// config routes
const devLogRoutes = require('./lib/routes/devlog');
const forumRoutes = require('./lib/routes/forum');
const authRoutes = require('./lib/routes/auth');
app.use(devLogRoutes);
app.use(forumRoutes);
app.use(authRoutes);
console.log('-- game')
// game socket
// const indexGameLocation = require('./lib/game/locations/');
// indexGameLocation.attach(server);

app.get('/', (req, res) => {
  console.log('req.user = ', req.user);
  res.json({ message: 'Hello, world!' });
});

app.get('*', (req, res) => {
  res.status(404).send({ message: 'This route does not exist' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT)
});

module.exports = app
