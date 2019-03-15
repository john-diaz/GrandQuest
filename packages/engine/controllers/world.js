/* ./packages/engine/world */

const store = require('../store'),
      _ = require('underscore');

module.exports = (namespace) => {
  const worldTimeStart = Date.now();

  store.update('places', (places) => ({
    ...places,
    world: {
      ...places.world,
      timeOfDay: worldTimeStart,
    }
  }));

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
}
