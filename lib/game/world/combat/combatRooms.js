/* ./lib/game/world/combat/roomManager.js */

/*
  Import dependencies
*/
const fs = require('fs'),
      path = require('path');

const Entity = require('../../models/entities');

/*
  Path to storage files
*/

const pathToStorage = path.join(__dirname, '..', '..', 'storage');
const pathToPlayers = path.join(pathToStorage, 'players');
const pathToCombatRooms = path.join(pathToStorage, 'combatRooms');
const pathToWorld = path.join(pathToStorage, 'world.json');

const removePlayerFromRoom = (socket, done) => {
  const cb = typeof done === 'function' ? done : () => {};

  const pathToCombatRoom = path.join(pathToCombatRooms, `${socket.roomID}.json`)

  if (!fs.existsSync(pathToCombatRoom)) {
    return cb('There are no combat rooms matching this id');
  }

  // update room state
  let room = JSON.parse(fs.readFileSync(pathToCombatRoom, 'utf8'));

  delete room.players[socket.userID];
  room.playerCount = Object.keys(room.players).length;
  if (!room.playerCount) {
    console.log('Combat game - OFF')
    room.gameRunning = false;
  }

  fs.writeFileSync(pathToCombatRoom, JSON.stringify(room));

  let worldState = JSON.parse(fs.readFileSync(pathToWorld, 'utf8'));
  worldState.inCombat--;
  fs.writeFileSync(pathToWorld, JSON.stringify(worldState));

  socket.leave(socket.roomID);
  delete socket.roomID;
  // update socket
  if (typeof cb === 'function') cb(null);
}

module.exports = () => (socket) => {
  /*
    Sockt combat room events
  */

  /**
   * Connection of player to a combat room
   */
  socket.on('COMBAT_ROOM_CONNECT', (roomID, cb) => {
    /*
      Check for variables
    */
    if (typeof roomID !== 'string' || roomID.trim().length < 10) {
      return cb('No roomID provided');
    }
    /*
      Authentication of player
    */
    if (!socket.userID) {
      return cb('You dont appear to be authenticated');
    }

    const pathToPlayer = path.join(pathToPlayers, `${socket.userID}.json`);

    if (!fs.existsSync(pathToPlayer)) {
      return cb('You dont appear to be authenticated');
      
    }
    // find player data from world state
    const player = JSON.parse(fs.readFileSync(pathToPlayer, 'utf8'));

    // return if player is not available
    if (!player) {
      return cb('You dont appear to be authenticated');
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
      // Maybe we should store players in a separate folder in storage
      if (room.playerCount === room.maxPlayers) // ROOM IF FULL ?
      {
        cb('This room is already full');
      } 
      else if (players.hasOwnProperty(socket.userID))  // PLAYER IS ALREADY IN ROOM ?
      {
        cb('You are already in this room');
      } 
      else // Add the player
      {
        let newRoom = {...room};

        newRoom.players[socket.userID] = {
          id: socket.userID,
          username: player.username,
          enemy: false,
          level: player.level,
          xp: player.xp,
          weapon_id: player.weapon_id,
          weapon_health: player.weapon_health,
          entity: Entity.Adventurer(), // set this to the role the player is doing
          selectionStatus: -1,
        };
        newRoom.playerCount = Object.keys(newRoom.players).length;
        // update file
        fs.writeFileSync(pathToRoom, JSON.stringify(newRoom));

        socket.roomID = roomID;
        socket.join(roomID);

        // world state players inCombat increase
        let worldState = JSON.parse(fs.readFileSync(pathToWorld, 'utf8'));
        worldState.inCombat++;
        fs.writeFileSync(pathToWorld, JSON.stringify(worldState));
        // OK!
        cb(null);
        console.log(`! SOCKET connected to combat room. id(${roomID})`);
      }
    } else {
      // room by this id does not exist
      cb('Room by this id does not exist');
    }
  });

  /**
   * Combat room selection event -
   * This is fired when the player has chosen an
   * event like attack or potion
   * @param {Object} event - The selected event dispatched by the player
   * @param {string} event.receiverId - ID of the character being exposed to the chosen event
   * @param {Object} event.action - The selected action dispatched by the player
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
      return; // player is not in the room
    }

    let player = room.players[socket.userID];
    
    /*
      Check that it is the player's trun
    */
    if (room.turn % 2) {
      return // this is the enemies turn
    }
    /*
      Check that the player has not selected an event yet
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

  /**
   *  Selection ready to continue to next level
   */
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

    fs.readFile(pathToRoom, { encoding: 'utf8' }, (err, data) => {
      if (err) throw err;

      let room = JSON.parse(data);

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
    removePlayerFromRoom(socket, cb);
  });
  socket.on('disconnect', () => {
    console.log('combat room force disconnection ', socket.roomID);
    if (socket.userID && socket.roomID) {
      removePlayerFromRoom(socket);
    }
  });
}