
module.exports = (worldStore, io) => {
  let namespace = io.of('/combat');

  const roomManager = require('./roomManager')(worldStore);

  let gameLoop = null;
  let t1 = Date.now();

  const gameTick = () => {
    if (Date.now() - t1 > 200) {
      let rooms = roomManager.fetchRoomsData();
      namespace.emit('COMBAT_GAME_STATE', {
        rooms,
      });
      t1 = Date.now();
    }
  }
  const startGameLoop = () => {
    if (gameLoop) {
      throw new Error('Combat: Attempted to initiate game loop while one already ran');
    }

    gameLoop = true;
    const gameClock = setInterval(() => {
      if (Object.keys(namespace.connected).length) {
        gameTick();
      } else {
        clearInterval(gameClock);
        gameLoop = null;
      }
    }, 10);
  }

  namespace.on('connect', (socket) => {
    const connectionsLength = Object.keys(namespace.connected).length;
    worldStore.dispatch({ type: 'COMBAT_SET_CONNECTIONS', payload: connectionsLength });

    if (connectionsLength == 1) {
      startGameLoop();
    }

    socket.on('disconnect', () => {
      const connectionsLength = Object.keys(namespace.connected).length;

      worldStore.dispatch({ type: 'COMBAT_SET_CONNECTIONS', payload: connectionsLength });
    });
  });
}
