/* ./packages/data/entities.js */

const attacks = require('./attacks');

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
});

module.exports.MountainWarrior = () => ({
  name: 'mountain-warrior',
  health: 70,
  maxHealth: 70,
  energy: 5,
  energyRate: 5,
  attacks: {
    'mountain-warrior-slash': attacks['mountain-warrior-slash']
  },
});

module.exports.Adventurer = (combatant) => ({
  name: 'adventurer',
  health: combatant.health,
  maxHealth: combatant.max_health,
  energy: 16,
  maxEnergy: 30,
  energyRate: 11, // rate at which energy charges
  attacks: {
    'adventurer-swing': attacks['adventurer-swing'],
    'adventurer-up-swing': attacks['adventurer-up-swing'],
    'adventurer-back-swing': attacks['adventurer-back-swing'],
    'adventurer-spin-swing': attacks['adventurer-spin-swing'],
  },
});