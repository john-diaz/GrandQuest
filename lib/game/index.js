/* ./lib/game/index.js */

const _ = require('underscore');
const async = require('async');
const pool = require('../db/client');
const store = require('./store');

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
  let marketEvents = require('./world/market')(namespace);

  let ut = Date.now();
  let pt = Date.now();
  let wt = Date.now();
  const gameTick = () => {
    const now = Date.now();
    const delta = now - worldTimeStart;
    const gameUnitToSeconds = 30;
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
    marketEvents(socket);
    
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

        let player = _.omit(results.rows[0], (v, key) => _.contains([ 'token', 'hashed_password', 'email' ], key));

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
              weapon_health = ${player.weapon_health},
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
