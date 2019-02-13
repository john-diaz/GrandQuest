/* ./lib/game/models/entities.js */

const attacks = require('../data/attacks');

module.exports.Slime = () => ({
  name: 'slime',
  health: 20,
  maxHealth: 20,
  energy: 5,
  maxEnergy: 10,
  energyRate: 5, // rate at which energy charges
  attacks: {
    'slime-bite': attacks['slime-bite'],
  },
  inventory: {
    'heal-potion': { id: 'heal-potion', type: 'potion', amount: 2 },
  },
});

module.exports.Adventurer = () => ({
  name: 'adventurer',
  health: 50,
  maxHealth: 50,
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
});