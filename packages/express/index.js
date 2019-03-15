/* ./packages/express/index.js */

const express = require('express'),
      cors = require('cors');

// App routes
const devLogRoutes = require('./routes/devlog');
const forumRoutes = require('./routes/forum');
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/player');

/*
  Configure app
*/
const app = express();

// parse json body
app.use(express.json());

// enable CORS
let origin = process.env.CLIENT_ORIGIN || 'http://localhost:8080';

console.log(`$ CORS client origin = '${origin}'`);

app.use(cors({
  origin,
}));

// config routes
app.use(devLogRoutes);
app.use(forumRoutes);
app.use(authRoutes);
app.use(playerRoutes);

/*
  404 route
*/
app.get('*', (req, res) => {
  res.status(404).send({ message: 'This route does not exist' });
});

module.exports = app