/* ./lib/game/world/combat/roomManager.js */

/*
  Import dependencies
*/
const store = require('../../store'),
      path = require('path'),
      _ = require('underscore')
      pool = require('../../../db/client');

const Entity = require('../../definitions/entities');

const removePlayerFromRoom = (socket, done) => {
  const cb = typeof done === 'function' ? done : () => {};

  const state = store.getState();
  const room = state.places.combat.rooms[socket.roomID];

  if (!room) {
    return cb('There are no combat rooms matching this id');
  }

  const gamePlayer = room.players[socket.userID];
  if (!gamePlayer) {
    return cb('You don\'t appear to be in his room');
  }

  delete room.players[socket.userID];
  room.playerCount = Object.keys(room.players).length;

  if (!room.playerCount) {
    console.log('Combat game - OFF')
    room.gameRunning = false;
  }

  // save combat room changes
  store.update('places', (places) => ({
    ...places,
    combat: {
      ...places.combat,
      inCombat: places.combat.inCombat - 1,
      rooms: {
        ...places.combat.rooms,
        [room.id]: room,
      },
    }
  }));

  // update player
  const player = state.players[gamePlayer.id];
  const newPlayer = {
    ...player,
    level: gamePlayer.level,
    xp: gamePlayer.xp,
    // gold gamePlayer.gold
  };
  if (!_.isEqual(player, newPlayer)) {
    store.update('players', (players) => ({
      ...players,
      [gamePlayer.id]: newPlayer,
    }))
    console.log('saved changes from combat room');
  }
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
  socket.on('COMBAT_ROOM_CONNECT', (cb) => {
    /*
      Authentication of player
    */
    if (!socket.userID) {
      if (typeof cb === 'function') cb('You don\'t appear to be authenticated');
      return;
    }
    /*
      Check if socket is connected to a room already
    */
   if (socket.roomID) {
     if (typeof cb === 'function') cb('You\'re already connected to a room');
     return;
   }

    const state = store.getState();
    const player = state.players[socket.userID];

    // pick a random room
    const rooms = _.filter(state.places.combat.rooms, (room) => {
      return room.playerCount <= room.maxPlayers;
    });
    if (!rooms.length) {
      if (typeof cb === 'function') cb('There are no rooms open at the moment.');
      return;
    }
    const room = rooms[Math.floor(Math.random() * rooms.length)];

    /*
      Add to room
    */
    const { players } = room;

    if (room.playerCount === room.maxPlayers) // ROOM IF FULL ?
    {
      if (typeof cb === 'function') cb('This room is already full');
    } 
    else if (players.hasOwnProperty(socket.userID))  // PLAYER IS ALREADY IN ROOM ?
    {
      if (typeof cb === 'function') cb('You are already in this room');
    } 
    else // Add the player
    {
      pool.query(`
      SELECT * FROM combatants
      WHERE id = ${socket.userID}
      `, (err, results) => {
        if (err || !results.rowCount) {
          if (typeof cb === 'function') cb('Failed to load player data. Please try again later.');
        } else {
          const combatant = results.rows[0];
          const newRoom = {
            ...room,
            playerCount: room.playerCount + 1,
            players: {
              ...room.players,
              [socket.userID]: {
                id: socket.userID,
                username: player.username,
                enemy: false,
                level: player.level,
                xp: player.xp,
                entity: Entity.Adventurer(combatant), // set this to the role the player is doing
                selectionStatus: room.turn % 2 == 0 ? 0 : -1,
              },
            },
          };

          // update file
          store.update('places', (places) => ({
            ...places,
            combat: {
              ...places.combat,
              inCombat: places.combat.inCombat + 1,
              rooms: {
                ...places.combat.rooms,
                [newRoom.id]: newRoom,
              },
            },
          }));

          socket.roomID = room.id;
          socket.join(room.id);

          // OK!
          console.log(`! SOCKET connected to combat room. id(${room.id})`);
          if (typeof cb === 'function') cb(null, room.id);
        }
      })
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
    const state = store.getState();
    const room = state.places.combat.rooms[socket.roomID];
    if (!room.playState) {
      return; // room not currently playing
    }
    /*
      Verify player is in room
    */
    if (!room.players.hasOwnProperty(socket.userID)) {
      return; // player is not in the room
    }

    const player = room.players[socket.userID];
    
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
    const newRoom = {
      ...room,
      queuedEvents: [
        ...room.queuedEvents,
        { characterId: socket.userID, ...event },
      ],
      players: {
        ...room.players,
        [socket.userID]: {
          ...player,
          selectionStatus: 1,
        },
      },
    };

    /*
      Save changes made to room
    */
    store.update('places', (places) => ({
      ...places,
      combat: {
        ...places.combat,
        rooms: {
          ...places.combat.rooms,
          [room.id]: newRoom,
        },
      },
    }));
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
    const state = store.getState();
    const room = state.places.combat.rooms[socket.roomID];

    if (room.playState) {
      return; // room not currently playing
    }
    if (!room.players[socket.userID]) {
      return;
    }

    room.readyToContinue[socket.userID] = true;

    store.update('places', (places) => ({
      ...places,
      combat: {
        ...places.combat,
        rooms: {
          ...places.combat.rooms,
          [room.id]: room,
        },
      },
    }));
  });
  socket.on('COMBAT_ROOM_LEAVE', (cb) => {
    if (!socket.userID) {
      if (typeof cb === 'function') cb('You dont appear to be authenticated');
      return;
    }
    if (!socket.roomID) {
      if (typeof cb === 'function') cb('You dont appear to be connected to a combat room');
      return;
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