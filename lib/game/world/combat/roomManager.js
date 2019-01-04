const _ = require('underscore');

module.exports = (worldStore) => {
  const roomGenerator = require('./room')(worldStore);
  
  let rooms = {};

  let defaultRooms = [
    {title:"Lone hero's trial", maxPlayers: 1},
    {title:"Example room", maxPlayers: 2},
    {title:"Jester's adventure", maxPlayers: 3},
    {title:"Skepdimi's journey", maxPlayers: 4},
  ]
  for (let i = 0; i < defaultRooms.length; i++) {
    let room = roomGenerator(defaultRooms[i]);
    rooms[room.id] = room;
  }

  let roomManager = {
    fetchRoomsData() {
      // we dont want to send
      // the entire room data
      return {...rooms}
    },
  };

  return roomManager;
};
