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
  users: {},
}

/*
  Declare paths to storage files
*/
const pathToStorage = path.join(__dirname, 'storage');
const pathToWorld = path.join(pathToStorage, 'world.json');
const pathToCombatRooms = path.join(pathToStorage, 'combatRooms.json');

/*
  Check if storage directory exists
*/
if (fs.existsSync(pathToStorage)) {
  /*
    Check for world.json
  */
  if (!fs.existsSync(pathToWorld)) console.error('$ STORAGE - Missing world state file in storage');
  /*
    Disconnect all players from world.json state
  */
  const worldState = JSON.parse(fs.readFileSync(pathToWorld));

  let newUsers = _.mapObject(worldState.users, (user) => {
    return { ...user, connected: false }
  });

  fs.writeFileSync(pathToWorld, JSON.stringify({
    ...worldState,
    users: newUsers,
  }));

  /*
    Check for combatRooms.json
  */
  if (!fs.existsSync(pathToCombatRooms)) console.error('$ STORAGE - Missing combat rooms file in storage');

  console.log('$ STORAGE - exists');
} else {
  /*
    Create storage files
  */

  // storage directory
  fs.mkdirSync(pathToStorage);

  // world.json
  fs.appendFileSync(pathToWorld, JSON.stringify(initialState));
  // combatRooms.json
  fs.appendFileSync(pathToCombatRooms, '{}')

  console.log('$ STORAGE - created');
}

module.exports = io => {
  let namespace = io.of('/game');

  let joinCombatHub = require('./world/combat')(namespace);

  var stateUpdateInterval = { date: 0, update: 500 }; 
  var clientUpdateInterval = { date: 0, update: 1000 };

  const gameTick = () => {
    const now = Date.now();
    const worldState = JSON.parse(fs.readFileSync(pathToWorld));

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
    socket.on('AUTHENTICATE_SOCKET', (token) => {
      if (typeof token !== 'string' || token.trim().length < 10) {
        return console.log('ERROR: invalid token given when authenticating socket.');
      }

      const worldState = JSON.parse(fs.readFileSync(pathToWorld));

      pool.query('SELECT * FROM users WHERE token = $1', [token], (err, results) => {
        if (err || !results.rowCount) {
          return
        }
        
        let user = results.rows[0];
        
        let existingUser = worldState.users[user.id];

        if (existingUser && existingUser.connected) {
          return console.log('$ SOCKET: auth error, user already is online');
        }

        socket.userID = user.id;

        fs.writeFileSync(pathToWorld, JSON.stringify({
          ...worldState,
          users: {
            ...worldState.users,
            [user.id]: {...user, connected: true},
          },
          connections: Object.keys(namespace.connected).length,
        }));
        console.log("! SOCKET authenticated");
      });
      socket.on('COMBAT_HUB_CONNECT', (cb) => {
        if (!socket.userID) {
          if (typeof cb === 'function') cb('COMBAT_HUB_CONNECT', 'You don\'t appear to be authenticated');
          return;
        }

        joinCombatHub(socket);
        if (typeof cb === 'function') cb(null);
      });
    });
    // socket disconnection
    socket.on('disconnect', () => {
      const worldState = JSON.parse(fs.readFileSync(pathToWorld));
      let newUsers = {...worldState.users};
      
      if (socket.userID) {
        newUsers[socket.userID] = {...newUsers[socket.userID], connected: false}
        console.log('disconnected user ', socket.userID);
      } else {
        console.log('disconnected ', socket.id);
      }
      fs.writeFileSync(pathToWorld, JSON.stringify({
        ...worldState,
        users: newUsers,
        connections: Object.keys(namespace.connected).length,
      }));
    });
  });
}
