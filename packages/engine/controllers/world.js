/* ./packages/engine/world */

const store = require('../store'),
      _ = require('underscore');

const io = require('../../socketServer');

const namespace = io.of('/game');

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
  const gameUnitToSeconds = 60;
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
        connections: Object.keys(state.users).length,
      },
    }));

    ut = Date.now()
  }
  /*
    Emit user states to sockets
  */
  if (now - pt > 500) {
    _.forEach(namespace.sockets, socket => {
      if (socket.userID) {
        let user = state.users[socket.userID];
        socket.emit('USER_STATE', user)
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