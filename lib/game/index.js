/* ./lib/game/index.js */

const _ = require('underscore');
const async = require('async');
const fs = require('fs');
const path = require('path');
const pool = require('../db/client');

/*
  Initial state of the world state
  This object is used in case storage 
  has not been initiated
*/

/*
  Declare paths to storage files
*/
const pathToStorage = path.join(__dirname, 'storage');
const pathToPlayers = path.join(pathToStorage, 'players');
const pathToCombatRooms = path.join(pathToStorage, 'combatRooms');
const pathToWorld = path.join(pathToStorage, 'world.json');

/*
  Reset storage
*/
// Reset players directory
if(fs.existsSync(pathToPlayers)) {
  let files = fs.readdirSync(pathToPlayers)
  for (const file of files) {
    fs.unlinkSync(path.join(pathToPlayers, file));
  }
} else {
  fs.mkdirSync(pathToPlayers);
}
// Reset combatRooms directory
if (fs.existsSync(pathToCombatRooms)) {
  let files = fs.readdirSync(pathToCombatRooms)
  for (const file of files) {
    fs.unlinkSync(path.join(pathToCombatRooms, file));
  }
} else {
  fs.mkdirSync(pathToCombatRooms);
}

const worldTimeStart = Date.now();
// Reset for world.json
fs.writeFileSync(pathToWorld, JSON.stringify({
  timeOfDay: 0,
  connections: 0,
  inCombat: 0,
}));

console.log('$ STORAGE reset');

module.exports = io => {
  let namespace = io.of('/game');

  let combatHubEvents = require('./world/combat')(namespace);
  let combatRoomEvents = require('./world/combat/combatRooms')();
  let marketEvents = require('./world/market')(namespace);

  var stateUpdateInterval = { date: 0, update: 500 }; 
  var clientUpdateInterval = { date: 0, update: 1000 };

  const gameTick = () => {
    const now = Date.now();
    const delta = now - worldTimeStart;
    const gameUnitToSeconds = 30;
    const worldState = JSON.parse(fs.readFileSync(pathToWorld, 'utf8'));

    /*
      Update the world state
    */
    if (now - stateUpdateInterval.date > stateUpdateInterval.update) {
 
      fs.writeFileSync(pathToWorld, JSON.stringify({
        ...worldState,
        timeOfDay: now + (delta * gameUnitToSeconds),
        connections: Object.keys(namespace.connected).length,
      }));
 
      stateUpdateInterval.date = Date.now()
    }
    /*
      Emit world state to client
    */
    if (now - clientUpdateInterval.date > clientUpdateInterval.update) {
      namespace.emit('WORLD_STATE', worldState);

      clientUpdateInterval.date = Date.now();
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

        let pathToPlayer = path.join(pathToPlayers, `${player.id}.json`);
        
        if (fs.existsSync(pathToPlayer)) {
          if (typeof cb === 'function') cb('Player is already online')
          return;
        }
        console.log('connected as ', player.username);

        fs.writeFileSync(pathToPlayer, '{}');

        fs.watch(pathToPlayer, () => {
          if (fs.existsSync(pathToPlayer)) {
            const data = fs.readFileSync(pathToPlayer, 'utf8');
            const player = JSON.parse(data);
            socket.emit('PLAYER_STATE', player);
          }
        });

        fs.writeFileSync(pathToPlayer, JSON.stringify(player));
        socket.userID = player.id;

        console.log("! SOCKET authenticated");
        if (typeof cb === 'function') cb(null, player)
      });
    });
    // socket disconnection
    socket.on('disconnect', () => {
      if (socket.userID) {
        let pathToPlayer = path.join(pathToPlayers, `${socket.userID}.json`);

        const player = JSON.parse(fs.readFileSync(pathToPlayer, 'utf8'));

        console.log('player disconnected as ', player);

        fs.unlinkSync(pathToPlayer);
        console.log('removed player ', socket.userID);

        pool.query(`UPDATE players SET gold = $1, weapon_health = $2 WHERE id = ${socket.userID}`, [player.gold, player.weapon_health], (err) => {
          if (err) throw err;
          console.log('! SOCKET saved changes to database')
        });
      }

      console.log('disconnected ', socket.id);
    });
  });
}
