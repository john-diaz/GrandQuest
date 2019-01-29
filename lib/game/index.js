/* ./lib/game/index.js */

const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const pool = require('../db/client');

/*
  Initial state of the world state
  This object is used in case storage 
  has not been initiated
*/
const initialState = {
  timeOfDay: 6500, // 0 - 24000
  connections: 0,
}

/*
  Declare paths to storage files
*/
const pathToStorage = path.join(__dirname, 'storage');
const pathToPlayers = path.join(pathToStorage, 'players');
const pathToCombatRooms = path.join(pathToStorage, 'combatRooms');
const pathToWorld = path.join(pathToStorage, 'world.json');

/*
  Check if storage directory exists
*/
if (fs.existsSync(pathToStorage)) {
  /*
    Check for players directory
  */
  if(fs.existsSync(pathToPlayers)) {
    let files = fs.readdirSync(pathToPlayers)
    for (const file of files) {
      fs.unlinkSync(path.join(pathToPlayers, file));
    }
  } else {
    console.warn('$ STORAGE - Missing players directory');
  }
  /*
    Check for combatRooms directory
  */
  // if the combat rooms directory exists
  if (fs.existsSync(pathToCombatRooms)) {
    let files = fs.readdirSync(pathToCombatRooms)
    for (const file of files) {
      fs.unlinkSync(path.join(pathToCombatRooms, file));
    }
  } else {
    console.error('$ STORAGE - Missing combat rooms directory');
  }

  /*
    Check for world.json
  */
  if (!fs.existsSync(pathToWorld)) console.error('$ STORAGE - Missing world state file in storage');


  console.log('$ STORAGE - exists');
} else {
  /*
    Create storage files
  */

  // storage directory
  fs.mkdirSync(pathToStorage);
  // players directory
  fs.mkdirSync(pathToPlayers);
  // combatRooms
  fs.mkdirSync(pathToCombatRooms);
  // world.json
  fs.appendFileSync(pathToWorld, JSON.stringify(initialState));

  console.log('$ STORAGE - created');
  throw new Error('Storage has been created. Please rerun app while ignoring `', pathToStorage, '` to prevent restarting server on storage change');
  process.exit();
}

module.exports = io => {
  let namespace = io.of('/game');

  let combatHubEvents = require('./world/combat')(namespace);
  let combatRoomEvents = require('./world/combat/combatRooms')();

  var stateUpdateInterval = { date: 0, update: 500 }; 
  var clientUpdateInterval = { date: 0, update: 1000 };

  const gameTick = () => {
    const now = Date.now();
    const worldState = JSON.parse(fs.readFileSync(pathToWorld, 'utf8'));

    /*
      Update the world state
    */
    if (now - stateUpdateInterval.date > stateUpdateInterval.update) {
      // update time of day
      let timeOfDay = worldState.timeOfDay + 10
      if (timeOfDay > 24000) timeOfDay -= 24000;
 
      fs.writeFileSync(pathToWorld, JSON.stringify({
        ...worldState,
        timeOfDay,
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

        console.log('connected as ', player);
        let pathToPlayer = path.join(pathToPlayers, `${player.id}.json`);

        if (fs.existsSync(pathToPlayer)) {
          if (typeof cb === 'function') cb('Player is already online')
          return;
        }

        socket.userID = player.id;
        // create storage file for player
        fs.writeFileSync(pathToPlayer);
        // watch file
        fs.watch(pathToPlayer, () => {
          if (fs.existsSync(pathToPlayer)) {
            const player = JSON.parse(fs.readFileSync(pathToPlayer, 'utf8'));
            socket.emit('PLAYER_STATE', player);
          }
        });
        // make first update
        fs.writeFileSync(pathToPlayer, JSON.stringify(player));
        console.log("! SOCKET authenticated");
        if (typeof cb === 'function') cb(null)
      });
    });
    // socket disconnection
    socket.on('disconnect', () => {
      if (socket.userID) {
        let pathToPlayer = path.join(pathToPlayers, `${socket.userID}.json`);

        // TODO: Save changes done to player to the DB
        const player = JSON.parse(fs.readFileSync(pathToPlayer, 'utf8'));
        console.log('player disconnected as ', player);

        fs.unlink(pathToPlayer, (err) => {
          if (err) throw err;
          console.log('removed player ', socket.userID);
        });
      }

      console.log('disconnected ', socket.id);
    });
  });
}
