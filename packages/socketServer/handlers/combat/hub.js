/* ./packages/socketServer/events/combat/hub.js */

const _ = require('underscore');
const store = require('../../../../packages/engine/store');

const io = require('../../index.js');
const namespace = io.of('/game');

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
const roomGenerator = require('../../../engine/controllers/combatRoom');

_.forEach([
  { title: "Lone hero's trial",  maxPlayers: 1 },
  { title: "Jester's adventure", maxPlayers: 3 },
  { title: "Skepdimi's journey", maxPlayers: 4 },
], roomGenerator);

// emit room data for each combat room
setInterval(() => {
  _.forEach(store.getState().places.combat.rooms, (room) => {
    // emit room state to users connected to the room
    namespace.to(room.id).emit('COMBAT_ROOM_STATE', room);
  });
}, (500));

module.exports = (socket) => {
  socket.on('COMBAT_HUB_CONNECT', (cb) => {
    socket.join('combat_hub');
    if (typeof cb === 'function') cb(null);
  });

  socket.on('COMBAT_HUB_DISCONNECT', (cb) => {
    socket.leave('combat_hub');
    if (typeof cb === 'function') cb(null);
  });
}
