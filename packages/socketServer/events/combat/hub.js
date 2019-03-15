/* ./packages/socketServer/events/combat/hub.js */

const _ = require('underscore');
const store = require('../../../../packages/engine/store');

/*
Export combat hub instance
*/
module.exports = (namespace) => {
  /*
    Will emit combat hub state to sockets 
    connected to the namespace
  */
  store.subscribe((prevState, state) => {
    const combatState = state.places.combat;

    namespace.to('combat_hub').emit('COMBAT_HUB_STATE', {
      // only send the room's title, playerCount and maxPlayers attributes
      rooms: _.mapObject(combatState.rooms, (v, k) => ({
        id: v.id,
        title: v.title,
        playerCount: v.playerCount,
        maxPlayers: v.maxPlayers,
      })),
      inCombat: combatState.inCombat,
    });
  });
  /*
    Generate default rooms
  */
  const roomGenerator = require('../../../engine/controllers/combatRoom')(namespace);

  _.forEach([
    { title: "Lone hero's trial",  maxPlayers: 1 },
    { title: "Jester's adventure", maxPlayers: 3 },
    { title: "Skepdimi's journey", maxPlayers: 4 },
  ], roomGenerator);

  // emit room data for each combat room
  setInterval(() => {
    _.forEach(store.getState().places.combat.rooms, (room) => {
      // emit room state to players connected to the room
      namespace.to(room.id).emit('COMBAT_ROOM_STATE', room);
    });
  }, (500));

  /*
    Return combat hub join function:
    Used when a socket emits "COMBAT_HUB_CONNECT"
    Will join socket to "combat" room
  */
  return (socket) => {
    socket.on('COMBAT_HUB_CONNECT', (cb) => {
      console.log('! SOCKET connected to combat hub');
      socket.join('combat_hub');
      if (typeof cb === 'function') cb(null);
    });
    
    socket.on('COMBAT_HUB_DISCONNECT', (cb) => {
      console.log('! SOCKET disconnected from combat hub');
      socket.leave('combat_hub');
      if (typeof cb === 'function') cb(null);
    });
  }
}
