
module.exports = (worldStore, io) => {
  let namespace = io.of('/combat');
  let gameLoop = null;
  let t1 = Date.now();

  const gameTick = () => {
    if (Date.now() - t1 > 1000) {
      const connections = Object.keys(namespace.connected).length;
      namespace.emit('COMBAT_GAME_STATE', { connections });
      t1 = Date.now();
    }
  }
  const startGameLoop = () => {
    if (gameLoop) {
      throw new Error('Combat: Attempted to initiate game loop while one already ran');
    }

    gameLoop = true;
    const gameClock = setInterval(() => {
      let connections = worldStore.getState().combat.connections;

      if (connections) {
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
