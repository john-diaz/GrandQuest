/* ./lib/game/world/combat/index.js */

const _ = require('underscore');
const fs = require('fs');
const path = require('path');

const pathToCombatRooms = path.join(__dirname, '..', '..', 'storage', 'combatRooms');

/*
Export combat hub instance
*/
module.exports = (namespace) => {
  /*
    Generate default rooms
  */
  const roomGenerator = require('./room')(namespace);

  _.forEach([
    { title: "Lone hero's trial",  maxPlayers: 1 },
    { title: "Jester's adventure", maxPlayers: 3 },
    { title: "Skepdimi's journey", maxPlayers: 4 },
  ], roomGenerator);
  /*
    Combat hub game loop:
    Will emit combat hub state to sockets 
    connected to the "combat" room
  */
  setInterval(() => {
    const rooms = {};

    fs.readdirSync(pathToCombatRooms)
    .forEach(roomName => {
      let pathToFile = path.join(pathToCombatRooms, roomName);
      let roomJSON = fs.readFileSync(pathToFile, 'utf8');
      let room = JSON.parse(roomJSON);

      rooms[room.id] = room;
    });

    namespace.to('combat').emit('COMBAT_HUB_STATE', {
      rooms,
    });
  }, 200);

  /*
    Return combat hub join function:
    Used when a socket emits "COMBAT_HUB_CONNECT"
    Will join socket to "combat" room
  */
  return (socket) => {
    socket.on('COMBAT_HUB_CONNECT', () => {
      if (!socket.userID) {
        if (typeof cb === 'function') cb('You don\'t appear to be authenticated');
        return;
      }

      console.log('! SOCKET connected to combat hub');
      socket.join('combat');
      
      if (typeof cb === 'function') cb(null);
    })
    
    socket.on('COMBAT_HUB_DISCONNECT', (cb) => {
      console.log('! SOCKET disconnected from combat hub');
      socket.leave('combat');
      if (typeof cb === 'function') cb(null);
    });
  }
}
