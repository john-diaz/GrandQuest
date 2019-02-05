/* ./lib/game/data/items/index.js */

const potions = require('./potions');
const weapons = require('./weapons');

let itemsData = {
  ...potions,
  ...weapons,
};

module.exports = itemsData;
