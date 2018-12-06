const fs = require('fs');
const path = require('path');
const express = require('express');

require('dotenv').config();

const helpers = require('./lib/helpers');
helpers.cache.flush();

const app = express();

app.use(express.static('./client'));

require('./lib/routes/devlog')(app);

// VIEWS

app.get('/', (req, res) => {
  console.log('$ SERVER: get /');

  getTemplate({ title: 'Home', htmlFileName: 'index.html' },  ({status, html}) => {
    console.log('$ SERVER: getTemplate => ', { status });

    res.status(status).send(html);
  });
});

app.get('/about', (req, res) => {
  getTemplate({ title: 'About' }, ({ status, html}) => {
    res.status(status).send(html);
  });
});

app.get('*', (req, res) => {
  res.status(404).send('404!');
});

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log('$ SERVER: listening at port ', PORT)
});

module.exports = app
