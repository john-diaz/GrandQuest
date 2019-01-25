/* ./lib/game/entities/slime.js */

const attacks = require('../data/attacks');

function Slime() {
  let state = {
    name: 'slime',
    attacks: {},
    health: 25,
    maxHealth: 25,
    defense: 1,
    energy: 5,
    maxEnergy: 10,
    energyRate: 5, // rate at which energy charges
    attacks: {
      'slime-bite': attacks['slime-bite'],
    },
    inventory: {
      'heal-potion': { id: 'heal-potion', type: 'potion', amount: 2 },
    },
  }

  return {...state}
}

module.exports = Slime
