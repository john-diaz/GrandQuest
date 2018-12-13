const express = require('express');
const app = express();

require('dotenv').config();

const helpers = require('./lib/helpers');
helpers.cache.flush();

const cors = require('cors');
// enable CORS
if (process.env.NODE_ENV == 'development') {
  app.use(cors({
    origin: 'http://localhost:8080',
  }));
}

// parse json body
app.use(express.static('./client'));

// config routes
const devLogRoutes = require('./lib/routes/devlog');
const forumRoutes = require('./lib/routes/forum');
app.use(devLogRoutes);
app.use(forumRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.get('*', (req, res) => {
  res.status(404).send({ message: 'This route does not exist' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT)
});

module.exports = app
