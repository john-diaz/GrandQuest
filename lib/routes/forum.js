const express = require('express');
const router = new express.Router();
const pool = require('../db/client');
const redisClient = require('../redisClient');

router.get('/forum/:title?', (req, res) => {
  const title = typeof req.params.title == 'string' ? req.params.title.trim().toLowerCase() : false;

  if (title) {
    const cacheKey = `DB:FORUMS:${title}`;

    redisClient.get(cacheKey, (err, val) => {
      if (!err && val) {
        const forum = JSON.parse(val);

        return res.set('Cache-Control', 'public').json({ message: 'Loaded forum', data: forum });
      }
      pool.query('SELECT * FROM forum WHERE LOWER(title) = $1', [title], (err, results) => {
        if(err || !results.rowCount) {
          return res.status(404).json({ message: 'Could not find forum' });
        }

        let forum = results.rows[0];

        redisClient.set(cacheKey, JSON.stringify(forum));
        res.json({ message: 'Loaded forums', data: forum });
      });
    });
  } else {
    const cacheKey = 'DB:FORUMS';

    redisClient.get(cacheKey, (err, val) => {
      if (!err && val) {
        const forums = JSON.parse(val);

        return res.set('Cache-Control', 'public').json({ message: 'Loaded forums', data: forums });
      }
      pool.query('SELECT * FROM forum', (err, results) => {
        if(err || !results.rowCount) {
          return res.status(404).json({ message: 'Could not find any forums' });
        }

        let forums = results.rows;
        console.log(forums);

        redisClient.set(cacheKey, JSON.stringify(forums));
        res.json({ message: 'Loaded forums', data: forums});
      });
    });
  }
});

module.exports = router
