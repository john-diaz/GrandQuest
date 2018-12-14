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

      // find the forum by it's title
      pool.query('SELECT * FROM forum WHERE LOWER(title) = $1', [title], (err, results) => {
        if(err || !results.rowCount) {
          return res.status(404).json({ message: 'Could not find forum' });
        }

        let forum = results.rows[0];

        // query for the boards associated to the forum
        pool.query('SELECT * FROM board WHERE id = ANY($1)', [forum.boards], (err, results) => {
          if (err) {
            return res.status(500).json({ message: 'Failed to find board where id...' });
          }

          forum.boards = [...results.rows];

          redisClient.set(cacheKey, JSON.stringify(forum));
          res.json({ message: 'Loaded forums', data: forum });
        });
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
        redisClient.set(cacheKey, JSON.stringify(forums));
        res.json({ message: 'Loaded forums', data: forums});
      });
    });
  }
});

module.exports = router
