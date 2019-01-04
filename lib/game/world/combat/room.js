const uuid = require('uuid/v4');

module.exports = (worldStore) => (data) => {
  let roomState = {
    title: '',
    maxPlayers: 4,
    ...data,
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