/* ./packages/socketServer/index.js */

const _ = require('underscore');
const pool = require('../services/psql/pool');
const store = require('../engine/store');

/* Create socket server and export */
const io = module.exports = require('socket.io')();

let namespace = io.of('/game');

// initialize socket handlers
let combatHubHandlers = require('./handlers/combat/hub');
let combatRoomHandlers = require('./handlers/combat/rooms');
let shopHandlers = require('./handlers/shops');

let worldController = require('../engine/controllers/world');

/*
  Namespace connection event
*/
namespace.on('connect', (socket) => {
  /*
    Socket events
  */
  combatHubHandlers(socket);
  combatRoomHandlers(socket);
  shopHandlers(socket);

  socket.on('AUTHENTICATE_SOCKET', (token, cb) => {
    if (typeof token !== 'string' || token.trim().length < 10) {
      if (typeof cb === 'function') cb('Invalid token provided')
      return;
    }

    if (socket.userID) {
      return cb('Socket already has authentication');
    }

    let state = store.getState();

    pool.query('SELECT * FROM users WHERE token = $1', [token], (err, results) => {
      if (err || !results.rowCount) {
        if (typeof cb === 'function') cb('Could not find any users with this token');
        return;
      }

      const dbUser = results.rows[0];

      let state = store.getState();
      let user;

      if (state.users[dbUser.id]) {
        user = state.users[dbUser.id];
      } else {
        user = {
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
          socketLock: null,
        };

        console.log(`AUTH: added ${user.username} to state`);

        store.update('users', (users) => ({
          ...users,
          [user.id]: user,
        }));
      }

      console.log(`AUTH: ${socket.id} authenticated as `, user.username);

      socket.userID = user.id;

      if (typeof cb === 'function') cb(null, user);
    });
  });
  // socket disconnection
  socket.on('disconnect', () => {
    console.log('disconnected ', socket.id);
    if (socket.userID) {
      const user = store.getState().users[socket.userID];

      // find any other sockets authenticated to this user
      const authenticatedSockets = _.filter(namespace.sockets, socket => socket.userID === user.id);

      if (!authenticatedSockets.length) {
        store.update('users', (users) => _.omit(users, user.id));
        console.log('Remove user', user.id, 'from state');
      }
    }
  });
});
