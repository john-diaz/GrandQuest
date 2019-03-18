const express = require('express');

const pool = require('../../services/psql/pool');

const router = new express.Router();

router.get('/combatant/:id', (req, res) => {
  // if (redis.getKey(`combatant-${id}`));

  pool.query('SELECT * FROM combatants WHERE id = $1', [req.params.id], (err, results) => {
    if (err || !results.rowCount) {
      res.status(404).json({ message: 'Could not find combat data' });
    } else {
    	const combatant = results.rows[0];

      res.json({
      	data: {
	      	health: combatant.health,
	      	maxHealth: combatant.max_health,
	      	levelsPlayed: combatant.levels_played,
	      	levelsWon: combatant.levels_won,
	      	levelsLost: combatant.levels_lost,
	      	maxLevel: combatant.max_level,
	      	power: combatant.power,
	      	defense: combatant.defense,
	      }
      });
    }
  });
});

module.exports = router;
