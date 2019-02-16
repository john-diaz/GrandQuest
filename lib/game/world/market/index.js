/* ./lib/game/world/index.js */

const async = require('async');
const store = require('../../store');

const items = require('../../definitions/items');

module.exports = (namespace) => (socket) => {
  /*
    Blacksmith option selection
  */
  socket.on('MARKET_BLACKSMITH_SELECT', (selected, fn) => {
    // fallback callback in case the socket did not provide one
    const cb = typeof fn === 'function' ? fn : () => {};

    if (!socket.userID) {
      return;
    }

    const player = store.getState().players[socket.userID];
    const weapon = items[player.weapon_id];

    switch(selected) {
      case 'REPAIR_WEAPON':
        if (player.weapon_health >= weapon.stats.maxHealth) {
          return cb('Your weapon seems to be in excellent condition.');
        }
        const price = (weapon.stats.maxHealth - player.weapon_health) * 5;
        if (price > player.gold) {
          return cb('I\'m afraid you don\'t have enough for a repair of ' + price + ' gold.');
        }

        const newPlayer = {
          ...player,
          gold: (player.gold - price) <= 0 ? 0 : player.gold - price,
          weapon_health: weapon.stats.maxHealth,
        };

        store.update('players', (players) => ({
          ...players,
          [player.id]: newPlayer,
        }));
        cb('Repair finished. Don\'t do it again, ok?');
        break;
    }
  });
}