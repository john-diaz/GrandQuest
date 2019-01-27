/* ./lib/game/world/combat/roomManager.js */

/*
  Import dependencies
*/
const fs = require('fs'),
      path = require('path');

const Adventurer = require('../../entities/adventurer');

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

        newRoom.players[socket.userID] = {
          id: socket.userID,
          username: user.username,
          enemy: false,
          entity: Adventurer(),
          selectionStatus: 0,
        };
        newRoom.playerCount = Object.keys(newRoom.players).length;

        // update file
        fs.writeFileSync(pathToRoom, JSON.stringify(newRoom));

        socket.roomID = roomID;
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

  /**
   * Combat room selection event -
   * This is fired when the user has chosen an
   * event like attack or potion
   * @param {Object} event - The selected event dispatched by the user
   * @param {string} event.receiverId - ID of the character being exposed to the chosen event
   * @param {Object} event.action - The selected action dispatched by the user
   * @param {string} event.action.type - Describes the type of action the player wants to take
   * @param {string} event.action.id - The ID of the sgelected action
   */
  socket.on('COMBAT_ROOM_ACTION', (event) => {
    /*
      Check for socket authentication
    */
    if (!socket.userID || !socket.roomID) {
      return;
    }
    /*
      Load room state
    */
    const pathToRoom = path.join(pathToCombatRooms, `${socket.roomID}.json`);

    if (!fs.existsSync(pathToRoom)){
      delete socket.roomID;
      return; // this room does not exist
    }

    let room = JSON.parse(fs.readFileSync(pathToRoom));
    if (!room.playState) {
      return; // room not currently playing
    }
    /*
      Verify player is in room
    */
    if (!room.players.hasOwnProperty(socket.userID)) {
      return; // user is not in the room
    }

    let player = room.players[socket.userID];
    
    /*
      Check that it is the user's trun
    */
    if (room.turn % 2) {
      return // this is the enemies turn
    }
    /*
      Check that the user has not selected an event yet
    */
    if (player.selectionStatus !== 0) { 
      return // player is not selecting
    }
    if (player.entity.health === 0) {
      return // player is dead
    }

    /* 
      TYPE CHECKING `event` object
    */
    if (typeof event != 'object') {
      return
    }

    const { action, receiverId } = event;

    if (typeof receiverId !== 'string' && isNaN(receiverId)) {
      return // invalid receiver id
    }
    if (typeof action != 'object') {
      return // invalid `action` object
    }
    if (typeof action.type !== 'string') {
      return // missing action.type
    }
    if (typeof action.id !== 'string') {
      return // missing action.id
    }
    /*
      Find the receiver in the room state
    */
    const receiver = {...room.players, ...room.enemies}[receiverId];

    if (receiver === undefined) {
      return // receiver does not exist in room
    }

    /*
      Check that the action can be applied to the receiver
    */
    switch(action.type) {
      case 'attack':
        let availableAttacks = player.entity.attacks;
        let chosenAttack = availableAttacks[action.id];

        if (!chosenAttack || player.entity.energy < chosenAttack.stats.energy) {
          return;
        }
        if (!receiver.enemy || !receiver.entity.health) {
          return;
        }
        break;
      case 'item':
        let chosenItem = player.entity.inventory[action.id];

        if (!chosenItem || !chosenItem.amount) {
          return;
        }
        break;
      default:
        return;
    }
    
    /*
      Push event to room queued events
    */
    room.queuedEvents.push({
      characterId: socket.userID,
      ...event,
    });

    room.players[socket.userID].selectionStatus = 1;

    /*
      Save changes made to room
    */
    fs.writeFileSync(pathToRoom, JSON.stringify(room));
  });
  socket.on('COMBAT_ROOM_READY', () => {
    /*
      Check for socket authentication
    */
    if (!socket.userID || !socket.roomID) {
      return;
    }
    /*
      Load room state
    */
    const pathToRoom = path.join(pathToCombatRooms, `${socket.roomID}.json`);

    if (!fs.existsSync(pathToRoom)){
      delete socket.roomID;
      return; // this room does not exist
    }

    let room = JSON.parse(fs.readFileSync(pathToRoom));
    if (room.playState) {
      return; // room not currently playing
    }
    if (!room.players[socket.userID]) {
      return;
    }

    room.readyToContinue[socket.userID] = true;
    console.log('ready to continue');
    fs.writeFileSync(pathToRoom, JSON.stringify(room));
  });
  socket.on('COMBAT_ROOM_LEAVE', (cb) => {
    if (!socket.userID) {
      if (typeof cb === 'function') cb('You dont appear to be authenticated');
      return
    }
    if (!socket.roomID) {
      if (typeof cb === 'function') cb('You dont appear to be connected to a combat room');
      return
    }

    const pathToCombatRoom = path.join(pathToCombatRooms, `${socket.roomID}.json`)

    if (!fs.existsSync(pathToCombatRoom)) {
      if (typeof cb === 'function') cb('There are no combat rooms matching this id');
      return
    }
      
    // update room state
    let room = JSON.parse(fs.readFileSync(pathToCombatRoom, 'utf8'));

    room.playerCount--;
    delete room.players[socket.userID];

    // save changes
    fs.writeFileSync(pathToCombatRoom, JSON.stringify(room));

    socket.leave(socket.roomID);
    delete socket.roomID;
    if (typeof cb === 'function') cb(null);
  });
  socket.on('disconnect', () => {
    console.log('cbr disconnect!!!', socket.roomID);
    if (socket.roomID) {
      const pathToCombatRoom = path.join(pathToCombatRooms, `${socket.roomID}.json`)

      if (!fs.existsSync(pathToCombatRoom)) {
        return
      }
      // update room state
      let room = JSON.parse(fs.readFileSync(pathToCombatRoom, 'utf8'));
      room.playerCount--;
      delete room.players[socket.userID];

      // save changes
      fs.writeFileSync(pathToCombatRoom, JSON.stringify(room));
    }
  });
}