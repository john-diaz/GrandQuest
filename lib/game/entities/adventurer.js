/* ./lib/game/entities/adventurer.js */

const healthState = require('./extends/healthState');

function Adventurer() {
  let state = {
    name: 'adventurer',
    attacks: {},
    defense: 5,
    energyRate: 10, // rate at which energy charges
  }

  return Object.assign(
    {},
    healthState(100),
    state,
  );
}

module.exports = Adventurer
