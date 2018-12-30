const gameState = require('./gameState');

module.exports = namespace => {
  var gameLoop = null;

  var stateUpdateInterval = { date: 0, update: 400 };
  var clientUpdateInterval = { date: 0, update: 1000 };

  const gameTick = () => {
    const now = Date.now();

    // update the client
    if (now - clientUpdateInterval.date > clientUpdateInterval.update) {
      namespace.emit('WORLD_STATE', gameState.getState());

      clientUpdateInterval.date = Date.now();
    }
    // update the state
    if (now - stateUpdateInterval.date > stateUpdateInterval.update) {
      // update time of day
      gameState.dispatch({ type: 'ADD_TICK' });

      stateUpdateInterval.date = Date.now()
    }
  }
  const startGameLoop = () => {
    if (gameLoop) {
      throw new Error('Attempted to initiate game loop while one already ran');
    }

    console.log('Started game clock');

    gameLoop = true;
    let connections = gameState.getState().connections;
    const gameClock = setInterval(() => {
      if (Object.keys(connections).length) {
        gameTick();
      } else {
        clearInterval(gameClock);
        gameLoop = null;
        console.log('Ended game clock');
      }
    }, 10);
  }

  console.log('initial connections = ', gameState.getState().connections);

  namespace.on('connect', (socket) => {
    gameState.dispatch({ type: 'CONNECT_USER', payload: socket.id });
    let connectionsArray = Object.keys(gameState.getState().connections);
    console.log('connected ', socket.id);
    if (connectionsArray.length === 1) {
      startGameLoop();
    }
    socket.on('disconnect', () => {
      console.log('disconnected ', socket.id);
      gameState.dispatch({ type: 'DISCONNECT_USER', payload: socket.id });
    });
  });
}
