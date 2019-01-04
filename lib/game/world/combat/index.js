
const gameState = {
  connections: 0,
  feed: [],
}

module.exports = (namespace, worldStore) => {
  namespace.on('connection', socket => {
    socket.on('disconnect', () => {
      gameState.connection -= 1;
    })
  });
}
