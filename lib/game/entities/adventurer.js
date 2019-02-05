/* ./lib/game/entities/adventurer.js */

const attacks = require('../data/attacks');

function Adventurer() {
  let state = {
    name: 'adventurer',
    health: 50,
    maxHealth: 50,
    defense: 5,
    energy: 15,
    maxEnergy: 20,
    energyRate: 10, // rate at which energy charges
    attacks: {
      'adventurer-swing': attacks['adventurer-swing'],
      'adventurer-up-swing': attacks['adventurer-up-swing'],
      'adventurer-back-swing': attacks['adventurer-back-swing'],
      'adventurer-spin-swing': attacks['adventurer-spin-swing'],
    },
    inventory: {
      'heal-potion': { name: 'Heal I', id: 'heal-potion', type: 'potion', amount: 2 },
    },
  };

  return {...state}
}

module.exports = Adventurer
