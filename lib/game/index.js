/* ./lib/game/index.js */

const _ = require('underscore');
const async = require('async');
const fs = require('fs');
const path = require('path');
const pool = require('../db/client');
const store = require('./store');

store.subscribe((s) => {
  fs.writeFileSync(path.join(__dirname, 'storage', 'state.json'), JSON.stringify(s, null, 2));
});
const worldTimeStart = Date.now();
// Reset for world.json
store.update('places', (places) => ({
  ...places,
  world: {
    ...places.world,
    timeOfDay: worldTimeStart,
  }
}));

module.exports = io => {
  let namespace = io.of('/game');

  let combatHubEvents = require('./world/combat/hub')(namespace);
  let combatRoomEvents = require('./world/combat/combatRooms')();
  let shopEvents = require('./world/shops')(namespace);

  let ut = Date.now();
  let pt = Date.now();
  let wt = Date.now();
  const gameTick = () => {
    const now = Date.now();
    const delta = now - worldTimeStart;
    const gameUnitToSeconds = 60 * 60;
    const state = store.getState();

    /*
      Update the world state
    */
    if (now - ut > 500) {
      store.update('places', (places) => ({
        ...places,
        world: {
          ...places.world,
          timeOfDay: (delta * gameUnitToSeconds) + now,
          connections: Object.keys(namespace.connected).length,
        },
      }));
 
      ut = Date.now()
    }
    /*
      Emit player states to sockets
    */
    if (now - pt > 500) {
      _.forEach(namespace.sockets, socket => {
        if (socket.userID) {
          let player = state.players[socket.userID];
          socket.emit('PLAYER_STATE', player)
        }
      });
      pt = Date.now();
    }
    /*
      Emit world state to client
    */
    if (now - wt > 1000) {
      namespace.emit('WORLD_STATE', state.places.world);
      wt = Date.now();
    }
  }

  /*
    World game loop
  */
  setInterval(gameTick, 100);

  /*
    Namespace connection event
  */
  namespace.on('connect', (socket) => {
    console.log('connected', socket.id);
    /*
      Socket events
    */
    // combat room socket events
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

      pool.query('SELECT * FROM users u INNER JOIN players p ON u.id = p.id WHERE token = $1', [token], (err, results) => {
        if (err || !results.rowCount) {
          if (typeof cb === 'function') cb('Could not find any players with this token');
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

        console.log("! SOCKET authenticated");
        if (typeof cb === 'function') cb(null, player)
      });
    });
    // socket disconnection
    socket.on('disconnect', () => {
      if (socket.userID) {
        const player = store.getState().players[socket.userID];

        store.update('players', (players) => _.omit(players, player.id));
        console.log('removed player ', player.id);

        pool.query(`
          UPDATE players
          SET gold = ${player.gold},
              xp = ${player.xp},
              level = ${player.level}
          WHERE id = ${socket.userID}
        `, (err) => {
          if (err) throw err;
          console.log('! SOCKET saved changes to database')
        });
      }

      console.log('disconnected ', socket.id);
    });
  });
}
