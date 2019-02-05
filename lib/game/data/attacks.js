/* ./lib/game/data/attacks.js */

module.exports = {
  'adventurer-swing': {
    name: 'Swing I',
    description: 'The adventurer\'s attack of choice',
    stats: {
      baseDamage: 1,
      energy: 8,
    },
  },
  'adventurer-up-swing': {
    name: 'Upper Swing',
    description: 'A brave swing ...',
    stats: {
      baseDamage: 8,
      energy: 15,
    },
  },
  'adventurer-back-swing': {
    name: 'Back Swing',
    description: 'A bold move ...',
    stats: {
      baseDamage: 12,
      energy: 20,
    },
  },
  'adventurer-spin-swing': {
    name: 'Swing Spin',
    description: 'A powerful combination of a swing and spin swing',
    stats: {
      baseDamage: 24,
      energy: 25,
    },
  },
  'slime-bite': {
    name: 'Slime Bite',
    description: 'Generic slime attack',
    stats: {
      baseDamage: 5,
      energy: 5,
    }
  }
}