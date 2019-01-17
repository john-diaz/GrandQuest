/* ./lib/game/entities/slime.js */

const healthState = require('./extends/healthState');

function Slime() {
  let state = {
    name: 'slime',
    attacks: {},
    defense: 2,
    energyRate: 5, // rate at which energy charges
  }

  return Object.assign(
    {},
    healthState(100),
    state,
  );
}

module.exports = Slime
