/* ./lib/game/entities/slime.js */

const attacks = require('../data/attacks');

function Slime() {
  let state = {
    name: 'slime',
    attacks: {},
    health: 50,
    maxHealth: 250,
    defense: 2,
    energy: 5,
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
