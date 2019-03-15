/* ./packages/socketServer/index.js */

const _ = require('underscore');
const pool = require('../services/psql/pool');
const store = require('../engine/store');

/* Create socket server and export */
const io = module.exports = require('socket.io')();

let namespace = io.of('/game');

// initialize socket events
let combatHubEvents = require('./events/combat/hub')(namespace);
let combatRoomEvents = require('./events/combat/rooms')();
let shopEvents = require('./events/shops')(namespace);

let worldController = require('../engine/controllers/world')(namespace);

/*
  Namespace connection event
*/
namespace.on('connect', (socket) => {
  /*
    Socket events
  */
  combatHubEvents(socket);
  combatRoomEvents(socket);
  shopEvents(socket);

  socket.on('AUTHENTICATE_SOCKET', (token, cb) => {
    if (typeof token !== 'string' || token.trim().length < 10) {
      if (typeof cb === 'function') cb('Invalid token provided')
      return;
    }

    if (socket.userID) {
      return cb('Socket already has authentication');
    }

    pool.query('SELECT * FROM users WHERE token = $1', [token], (err, results) => {
      if (err || !results.rowCount) {
        if (typeof cb === 'function') cb('Could not find any users with this token');
        return;
      }

      let player = {
        id: results.rows[0].id,
        username: results.rows[0].username,
        gender: results.rows[0].gender,
        isAdmin: results.rows[0].is_admin,
        createdAt: results.rows[0].created_at,
        // IMPORTANT: gold has to be turned into a Number because node-psql parses decimals as strings (https://github.com/brianc/node-postgres/issues/811)
        gold: Number(results.rows[0].gold),
        level: results.rows[0].level,
        xp: results.rows[0].xp,
        nextLevelXp: results.rows[0].next_level_xp,
      };

      let state = store.getState();
      if (state.players[player.id]) {
        if (typeof cb === 'function') cb('Player is already online')
        return;
      }

      console.log('connected as ', player.username);

      store.update('players', (players) => ({
        ...players,
        [player.id]: player,
      }));

      socket.userID = player.id;

      if (typeof cb === 'function') cb(null, player)
    });
  });
  // socket disconnection
  socket.on('disconnect', () => {
    if (socket.userID) {
      const player = store.getState().players[socket.userID];

      store.update('players', (players) => _.omit(players, player.id));

      pool.query(`
        UPDATE users
        SET gold = ${player.gold},
            xp = ${player.xp},
            level = ${player.level}
        WHERE id = ${socket.userID}
      `, (err) => {
        if (err) throw err;
      });
    }

    console.log('disconnected ', socket.id);
  });
});
