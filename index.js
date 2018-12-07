const express = require('express');
const cors = require('cors');

require('dotenv').config();

const helpers = require('./lib/helpers');
helpers.cache.flush();

const app = express();

if (process.env.NODE_ENV == 'development') {
  app.use(cors({
    origin: 'http://localhost:8080',
  }));
}

app.use(express.static('./client'));

require('./lib/routes/devlog')(app);

// VIEWS

app.get('/', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.get('*', (req, res) => {
  res.status(404).send({ message: 'This route does not exist' });
});

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT)
});

module.exports = app
