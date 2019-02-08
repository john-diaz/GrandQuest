/* ./lib/game/world/index.js */

const async = require('async');
const path = require('path');
const fs = require('fs');

const items = require('../../data/items');

const pathToPlayers = path.join(__dirname, '..', '..', 'storage', 'players');

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

    const pathToPlayer = path.join(pathToPlayers, `${socket.userID}.json`);
    const player = JSON.parse(fs.readFileSync(pathToPlayer, 'utf8'));
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

        fs.writeFileSync(pathToPlayer, JSON.stringify(newPlayer));
        cb('Repair finished. Don\'t do it again, ok?');
        break;
    }
  });
}