/* ./lib/game/world/combat/index.js */

const fs = require('fs');
const path = require('path');

const pathToCombatRooms = path.join(__dirname, '..', '..', 'storage', 'combatRooms.json');

const roomGenerator = require('./room');

/*
  Generate default rooms
*/

let rooms = {}

let defaultRooms = [
  { title: "Lone hero's trial",  maxPlayers: 1 },
  { title: "Example room",       maxPlayers: 2 },
  { title: "Jester's adventure", maxPlayers: 3 },
  { title: "Skepdimi's journey", maxPlayers: 4 },
];
defaultRooms.forEach(d => {
  let r = roomGenerator(d);
  rooms[r.id] = r;
});

fs.writeFileSync(pathToCombatRooms, JSON.stringify(rooms));
  
/*
  Export combat hub instance
*/
module.exports = (namespace) => {
  /*
    Combat hub game loop:
    Will emit combat hub state to sockets 
    connected to the "combat" room
  */
  setInterval(() => {
    const rooms = JSON.parse(fs.readFileSync(pathToCombatRooms));

    namespace.to('combat').emit('COMBAT_HUB_GAME_STATE', {
      rooms,
    });
  }, 200);

  /*
    Return combat hub join function:
    Used when a socket emits "COMBAT_HUB_CONNECT"
    Will join socket to "combat" room
  */
  return (socket) => {
    console.log('! SOCKET connected to combat hub');

    socket.join('combat');

    socket.on('COMBAT_HUB_DISCONNECT', () => {
      console.log('! SOCKET disconnected from combat hub');
      socket.leave('combat');
    });
  }
}
