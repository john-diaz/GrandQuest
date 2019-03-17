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

      const dbUser = results.rows[0];

      let state = store.getState();

      if (state.users[dbUser.id]) {
        if (typeof cb === 'function') cb('User is already online')
        return;
      }

      let user = {
        id: dbUser.id,
        username: dbUser.username,
        gender: dbUser.gender,
        isAdmin: dbUser.is_admin,
        createdAt: dbUser.created_at,
        // IMPORTANT: gold has to be turned into a Number because node-psql parses decimals as strings (https://github.com/brianc/node-postgres/issues/811)
        gold: Number(dbUser.gold),
        level: dbUser.level,
        xp: dbUser.xp,
        nextLevelXp: dbUser.next_level_xp,
      };

      console.log('connected as ', user.username);

      store.update('users', (users) => ({
        ...users,
        [user.id]: user,
      }));

      socket.userID = user.id;

      if (typeof cb === 'function') cb(null, user)
    });
  });
  // socket disconnection
  socket.on('disconnect', () => {
    if (socket.userID) {
      const user = store.getState().users[socket.userID];

      store.update('users', (users) => _.omit(users, user.id));
    }

    console.log('disconnected ', socket.id);
  });
});
