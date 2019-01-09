/* ./lib/game/world/combat/roomManager.js */

/*
  Import dependencies
*/
const fs = require('fs'),
      path = require('path');

/*
  Path to storage files
*/

const pathToUsers = path.join(__dirname, '..', '..', 'storage', 'users');
const pathToCombatRooms = path.join(__dirname, '..', '..', 'storage', 'combatRooms');

module.exports = () => (socket) => {
  /*
    Request to join a room
  */

  socket.on('COMBAT_ROOM_CONNECT', (roomID, cb) => {
    /*
      Check for variables
    */
    if (typeof roomID !== 'string' || roomID.trim().length < 10) {
      if (typeof cb === 'function') cb('No roomID provided');
      return;
    }
    /*
      Authentication of user
    */
    if (!socket.userID) {
      if (typeof cb === 'function') cb('You dont appear to be authenticated');
      return console.log('no socket user id');
    }

    const pathToUser = path.join(pathToUsers, `${socket.userID}.json`);

    if (!fs.existsSync(pathToUser)) {
      if (typeof cb === 'function') cb('You dont appear to be authenticated');
      return
    }
    // find user data from world state
    const user = JSON.parse(fs.readFileSync(pathToUser, 'utf8'));

    // return if user is not available
    if (!user) {
      if (typeof cb === 'function') cb('You dont appear to be authenticated');
      return;
    }

    // read combat rooms state
    const pathToRoom = path.join(pathToCombatRooms, `${roomID}.json`);

    // find room in combat rooms state
    if (fs.existsSync(pathToRoom)) {
      /*
        Add to room
      */
      const room = JSON.parse(fs.readFileSync(pathToRoom, 'utf8'));
      const { players } = room;

      // TODO: Make sure the player is not connected to another room
      //       disconnect player from room
      // Maybe we should store users in a separate folder in storage
      if (room.playerCount === room.maxPlayers) // ROOM IF FULL ?
      {
        if (typeof cb === 'function') cb('This room is already full');
      } 
      else if (players.hasOwnProperty(socket.userID))  // PLAYER IS ALREADY IN ROOM ?
      {
        if (typeof cb === 'function') cb('Youre already in this room');
      } 
      else // Add the player
      {
        let newRoom = {...room};

        newRoom.players[socket.userID] = user;
        newRoom.playerCount = Object.keys(newRoom.players).length;

        // update file
        fs.writeFileSync(pathToRoom, JSON.stringify(newRoom));

        socket.join(roomID);

        // OK!
        if (typeof cb === 'function') cb(null);
        console.log(`! SOCKET connected to combat room. id(${roomID})`)
      }
    } else {
      // room by this id does not exist
      if (typeof cb === 'function') cb('Room by this id does not exist');
    }
  });
}