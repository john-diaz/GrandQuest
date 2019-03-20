/* ./packages/socketServer/events/combat/rooms.js */

/*
  Import dependencies
*/
const store = require('../../../engine/store'),
      pool = require('../../../services/psql/pool'),
      _ = require('underscore'),
      items = require('../../../data/items');

const Entity = require('../../../data/entities');

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

  socket.leave(socket.roomID);
  delete socket.roomID;
  // update socket
  if (typeof cb === 'function') cb(null);
}

module.exports = (socket) => {
  /*
    Sockt combat room events
  */

  /**
   * Connection of player to a combat room
   */
  socket.on('COMBAT_ROOM_CONNECT', (id, cb) => {
    if (typeof id !== 'string') {
      if (typeof cb === 'function') cb('Invalid room id provided');
      return;
    }
    /*
      Authentication of player
    */
    if (!socket.userID) {
      if (typeof cb === 'function') cb('You don\'t appear to be authenticated to the server.');
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
    const user = state.users[socket.userID];

    // find the requested room
    const rooms = state.places.combat.rooms;
    if (!Object.values(rooms).length) {
      if (typeof cb === 'function') cb('There are no rooms open at the moment.');
      return;
    }

    const room = rooms[id];
    if (!room) {
      if (typeof cb === 'function') cb('No room by this id could be found.');
      return;
    }

    if (room.playerCount === room.maxPlayers) {
      if (typeof cb === 'function') cb('This room has been filled up to the max. Please try again later.');
      return;
    }

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
    else // Add the user
    {
      // get the combatant
      pool.query(`
      SELECT * FROM combatants
      WHERE id = ${socket.userID}
      `, (err, results) => {
        if (err || !results.rowCount) {
          if (typeof cb === 'function') cb('Failed to load user data. Please try again later.');
        } else {
          const combatant = results.rows[0];

          if (combatant.health <= 0) {
            if (typeof cb === 'function') cb('You are too low on health to combat! Go to the potions shop and heal yourself.');
            return;
          }

          // get the user_inventory
          pool.query(`
          SELECT item_id, uid FROM user_inventory
          WHERE user_id = ${socket.userID}
          `, (err, results) => {
            if (err) {
              if (typeof cb === 'function') cb('Failed to load user data. Please try again later.');
              return;
            }

            const inventory = _.reduce(results.rows, (memo, row) => {
              if (!memo[row.item_id]) {
                const selectedItem = items[row.item_id];
                memo[row.item_id] = {
                  id: selectedItem.id,
                  name: selectedItem.name,
                  type: selectedItem.type,
                  uids: [],
                }
              }

              return {
                ...memo,
                [row.item_id]: {
                  ...memo[row.item_id],
                  uids: [...memo[row.item_id].uids, row.uid],
                },
              }
            }, {});

            const newRoom = {
              ...room,
              playerCount: room.playerCount + 1,
              players: {
                ...room.players,
                [socket.userID]: {
                  id: socket.userID,
                  username: user.username,
                  enemy: false,
                  goldReward: 0,
                  xpReward: 0,
                  power: combatant.power,
                  defense: combatant.defense,
                  entity: Entity.Adventurer(combatant), // set this to the role the user is doing
                  selectionStatus: room.turn % 2 == 0 ? 0 : -1,
                  inventory,
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
            if (typeof cb === 'function') {
              // callback no error and send combat room
              cb(null, store.getState().places.combat.rooms[newRoom.id])
            };
          });
        }
      })
     }
  });

  /**
   * Combat room selection event -
   * This is fired when the user has chosen an
   * event like attack or potion
   * @param {Object} event - The selected event dispatched by the user
   * @param {string} event.receiverId - ID of the character being exposed to the chosen event
   * @param {Object} event.action - The selected action dispatched by the user
   * @param {string} event.action.type - Describes the type of action the user wants to take
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
      Verify user is in room
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
        let chosenItem = player.inventory[action.id];

        if (!chosenItem || !chosenItem.uids.length) {
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
        {
          character: { id: socket.userID, enemy: false },
          receiver: { id: receiver.id, enemy: receiver.enemy },
          action: event.action,
        },
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
    if (!room.levelRecord[room.level].won) {
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