const express = require('express');

const pool = require('../../services/psql/pool');

const router = new express.Router();

router.get('/leaderboards/gold', (req, res) => {
  // redis.getItem('leaderboards-gold');
  pool.query(`SELECT id, username, gold FROM users ORDER BY gold DESC LIMIT 25`)
  .then((results) => {
  	res.json({ data: results.rows });
  })
  .catch(() => {
    res.status(500).json({ message: 'Failed to load leaderboards' });
  });
});

router.get('/leaderboards/combat', (req, res) => {
  // redis.getItem('leaderboards-gold');
  pool.query(`
  	SELECT users.id, username, max_level, levels_won, levels_lost FROM users
  	INNER JOIN combatants
  	ON users.id = combatants.id
  	ORDER BY max_level DESC, levels_won DESC
  	LIMIT 25
  `)
  .then((results) => {
  	res.json({ data: results.rows });
  })
  .catch((err) => {
    res.status(500).json({ message: 'Failed to load leaderboards' });
  });
});

module.exports = router;
