/* ./lib/game/world/room.js */

const uuid = require('uuid/v4');

/*
  Export room creator function
  Will return a new roomState object
*/
module.exports = (data = {}) => {
  // Generate state
  let roomState = {
    // default data
    title: '',
    maxPlayers: 4,
    // custom data
    ...data,
    // non-customizable data
    id: uuid(),
    playerCount: 0,
    players: {},
    enemies: {},
    turn: -1,
    level: 0,
  }

  roomState.joinGame = () => {
    if (playerCount + 1 > maxPlayers) {
      return
    }

    // players[''] = player;
    
    playerCount++
  }

  return roomState;
}