const worldStore = require('./worldStore');
const pool = require('../db/client');

const fetchSocketUser = (socket) => {
  let users = worldStore.getState().world.users;
  let user = users[socket.userID];

  return !!user ? user : null;
}

module.exports = io => {
  require('./world/combat')(worldStore, io);
  let namespace = io.of('/game');

  var gameLoop = null;

  var stateUpdateInterval = { date: 0, update: 400 };
  var clientUpdateInterval = { date: 0, update: 1000 };

  const gameTick = () => {
    const now = Date.now();
    const state = worldStore.getState();

    // update the client
    if (now - clientUpdateInterval.date > clientUpdateInterval.update) {
      console.log('world connections: ', Object.keys(namespace.connected));
      namespace.emit('WORLD_STATE', {
        ...state.world,
        connections: Object.keys(namespace.connected).length,
      });

      clientUpdateInterval.date = Date.now();
    }
    // update the state
    if (now - stateUpdateInterval.date > stateUpdateInterval.update) {
      // update time of day
      worldStore.dispatch({ type: 'ADD_TICK' });

      stateUpdateInterval.date = Date.now()
    }
  }
  const startGameLoop = () => {
    if (gameLoop) {
      throw new Error('Attempted to initiate game loop while one already ran');
    }

    console.log('Started game clock');

    gameLoop = true;
    const gameClock = setInterval(() => {
      let connections = Object.keys(namespace.connected).length;

      if (connections) {
        gameTick();
      } else {
        clearInterval(gameClock);
        gameLoop = null;
        console.log('Ended game clock');
      }
    }, 10);
  }

  namespace.on('connect', (socket) => {
    console.log('connected ', socket.id);
    
    if (Object.keys(namespace.connected).length == 1) {
      startGameLoop();
    }
    socket.on('AUTHENTICATE_SOCKET', (token) => {
      if (typeof token !== 'string' || token.trim().length < 10) {
        return console.log('ERROR: invalid token given when authenticating socket.');
      }
      if (socket.userID) {
        return console.log('ERROR: socket attempted to authenticate but they already have a user id');
      }

      pool.query('SELECT * FROM users WHERE token = $1', [token], (err, results) => {
        if (err || !results.rowCount) {
          return
        }
        
        let user = results.rows[0];
        
        let existingUser = fetchSocketUser({ userID: user.id });

        if (existingUser) {
          return console.log('ERROR: user already exists');
        }

        socket.userID = user.id;
        worldStore.dispatch({
          type: 'ADD_USER', 
          payload: user,
        });
      });
    });
    socket.on('disconnect', () => {
      const connectionsLength = Object.keys(namespace.connected).length;

      worldStore.dispatch({ type: 'SET_CONNECTIONS', payload: connectionsLength });
      worldStore.dispatch({ type: 'DISCONNECT_USER', payload: socket });
      console.log('disconnected ', socket.id);
    });
  });
}
