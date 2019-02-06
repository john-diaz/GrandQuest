/* index.js */

/*
  Import dependencies
*/
const express = require('express'),
      socketio = require('socket.io'),
      http = require('http'),
      cors = require('cors'),
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

/*
  Relative imports
*/
//  Redis
const redisClient = require('./lib/redisClient');
// App routes
const devLogRoutes = require('./lib/routes/devlog');
const forumRoutes = require('./lib/routes/forum');
const authRoutes = require('./lib/routes/auth');

/*
  Configure app
*/
const app = express();

// parse json body
app.use(express.json());
// enable CORS
let origin = process.env.CLIENT_ORIGIN || 'http://localhost:8080';
console.log(`$ CORS client origin = '${origin}'`)
app.use(cors({
  origin,
}));

// config routes
app.use(devLogRoutes);
app.use(forumRoutes);
app.use(authRoutes);

const server = http.Server(app);
const io = socketio(server);

/*
  Initialize the game with our socket server
*/
require('./lib/game/')(io);

console.log('$ SERVER - NODE_ENV =', process.env.NODE_ENV);
console.log('$ SERVER - DB =', process.env.DB_NAME);

const { BCRYPT_SALT, JWT_KEY } = process.env;

if (!BCRYPT_SALT || BCRYPT_SALT == '') throw new Error('Invalid BCRYPT salt in env');
if (!JWT_KEY || JWT_KEY == '') throw new Error('Invalid JWT_KEY in env');

if (process.env.NODE_ENV === 'test') {
  redisClient.flushdb();
}

/*
  404 route
*/
app.get('*', (req, res) => {
  res.status(404).send({ message: 'This route does not exist' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT);
});

module.exports = app
