/* ./lib/game/world/room.js */

const uuid = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const _ = require('underscore');

const Slime = require('../../entities/slime');

const pathToCombatRooms = path.join(__dirname, '..', '..', 'storage', 'combatRooms');

/*
  Export room creator function
  Will return a new roomState object
*/
module.exports = (namespace) => (data = {}) => {
  // Generate state
  const roomState = {
    // default data
    title: '',
    maxPlayers: 4,
    // custom data
    ...data,
    // non-customizable data
    id: uuid(),
    playerCount: 0,
    players: {},
    // generate 4 enemies
    enemies: _.reduce([1,2,3,4], (memo) => {
      const id = uuid();
      return {
        ...memo,
        [id]: {
          id,
          enemy: true,
          username: 'Slime',
          entity: Slime(),
        }
      };
    }, {}),
    turn: 0,
    level: 0,
  }

  const pathToRoom = path.join(pathToCombatRooms, `${roomState.id}.json`);

  // Maybe we can create an observer and update combat rooms files on change???
  setInterval(() => {
    const roomState = JSON.parse(fs.readFileSync(pathToRoom, 'utf8'));

    if (roomState.playerCount) {
      // emit state
      namespace.to(roomState.id).emit('COMBAT_ROOM_STATE', roomState);
    }
  }, 1000);

  fs.writeFileSync(pathToRoom, JSON.stringify(roomState));
  return roomState;
}