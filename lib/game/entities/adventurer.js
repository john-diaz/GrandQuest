/* ./lib/game/entities/adventurer.js */

const attacks = require('../data/attacks');
const healthState = require('./extends/healthState');

function Adventurer() {
  let state = {
    name: 'adventurer',
    attacks: {},
    defense: 5,
    energyRate: 10, // rate at which energy charges
    attacks: {
      'adventurer-swing': attacks['adventurer-swing'],
      'adventurer-up-swing': attacks['adventurer-up-swing'],
      'adventurer-back-swing': attacks['adventurer-back-swing'],
      'adventurer-spin-swing': attacks['adventurer-spin-swing'],
    }
  }

  return Object.assign(
    {},
    healthState(100),
    state,
  );
}

module.exports = Adventurer
