/* ./lib/game/world/room.js */

const uuid = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const _ = require('underscore');

const Slime = require('../../entities/slime');

const pathToCombatRooms = path.join(__dirname, '..', '..', 'storage', 'combatRooms');

/*
  Export room creator function
  Will return a new roomState object
*/
module.exports = (namespace) => (data = {}) => {
  // Generate state
  const roomState = {
    // default data
    title: '',
    maxPlayers: 4,
    // custom data
    ...data,
    // non-customizable data
    id: uuid(),
    playerCount: 0,
    players: {},
    playState: 1, // 0 = pending to begin level, 1 = now playing
    // generate 4 enemies
    enemies: {},
    turn: 0,
    level: 0,
    queuedEvents: [],
    levelRecord: {},
    turnEvents: {},
  }

  const pathToRoom = path.join(pathToCombatRooms, `${roomState.id}.json`);

  // Maybe we can create an observer and update combat rooms files on change???
  setInterval(() => {
    let state = JSON.parse(fs.readFileSync(pathToRoom, 'utf8'));

    if (state.playState === 1) {
      const cat = state.turn % 2
      ? 'enemies'
      : 'players';
      const characters = state[cat];
      const nextCat = cat === 'enemies'
        ? 'players'
        : 'enemies';

      const takenAction = _.filter(characters, c => c.selectionStatus === 1);
      const alive = _.filter(characters, c => c.entity.health > 0);
      if (alive.length && takenAction.length >= alive.length) {
        const appliedEvents = applyEvents(state);

        state.turnEvents[state.turn] = appliedEvents;
        state.queuedEvents = [];
        state.turn++;

        // set selection status for characters that just chose
        state[cat] = _.mapObject(state[cat], c => ({
          ...c,
          selectionStatus: -1,
        }));
        // set selection status and energy for characters now choosing
        state[nextCat] = _.mapObject(state[nextCat], c => {
          let newEnergy = c.entity.energy + c.entity.energyRate;
          return {
            ...c,
            selectionStatus: 0,
            entity: {
              ...c.entity,
              energy: newEnergy >= c.entity.maxEnergy ? c.entity.maxEnergy : newEnergy,
            },
          }
        });

        const alive = _.filter(state[nextCat], c => c.entity.health > 0);
        if (!alive.length) {// this level is over! record everything!
          console.log(`no more ${nextCat} alive to attack! `, nextCat === 'players' ? 'Gameover!' : 'Success!');
          let levelRecord = recordLevel(state);
          state.levelRecord[state.level] = levelRecord;
          state.playState = 0;
        }

        // save changes done
        fs.writeFileSync(pathToRoom, JSON.stringify(state));

        // it's time for enemies to attack AND there are enemies alive
        if (alive.length && state.turn % 2) {
          enemyTurn(pathToRoom);
        }
      }
    } else {
      // game is pending to start
    }

    // Emit game state to connected players
    if (state.playerCount) {
      namespace.to(state.id).emit('COMBAT_ROOM_STATE', state);
    }
  }, 1000);

  fs.writeFileSync(pathToRoom, JSON.stringify(roomState));

  beginLevel(pathToRoom, 0);

  return roomState;
}

const beginLevel = (pathToRoom, lvl) => {
  let state = JSON.parse(fs.readFileSync(pathToRoom));

  state.level = lvl;
  state.levelRecord[lvl] = {};
  state.enemies = generateLevelEnemies(lvl);
  state.turn = 0;
  state.turnEvents = {};
  state.queuedEvents = [];

  fs.writeFileSync(pathToRoom, JSON.stringify(state));
}
const generateLevelEnemies = (lvl) => {
  switch(lvl) {
    case 0:
    // level 0: 4 Slime enemies
      return _.reduce([1,2,3,4], (m) => {
        const id = uuid();
        return {
          ...m,
          [id]: {
            id,
            enemy: true,
            username: 'Slime',
            entity: Slime(),
            selectionStatus: 0,
          }
        };
      }, {});
    default:
      return {};
  }
}
const recordLevel = (roomState) => {
  const record = {};

  /*
    Award players with gold for
    - Worth of enemies killed
    - Healing other players
    - Healing of self (at a rate of X gold per unit of health)
    - Amount of turns taken to complete level
  */
  _.forEach(roomState.turnEvents, (events) => {
    _.forEach(events, (event) => {
      const {
        characterId,
        receiverId,
        action,
        outcome,
      } = event;

      const character = {...roomState.players, ...roomState.enemies}[characterId];
      const receiver = {...roomState.players, ...roomState.enemies}[receiverId];
      if (!character || !receiver) {
        return;
      }
      if (!character.enemy && !record[characterId]) {
        record[characterId] = {
          damageDealt: 0,
          damageReceived: 0,
          gold: 0,
          killed: 0,
          healingPoints: 0,
        };
      } else if (!receiver.enemy && !record[receiverId]) {
        record[receiverId] = {
          damageDealt: 0,
          damageReceived: 0,
          gold: 0,
          killed: 0,
          healingPoints: 0,
        }
      }
      if (action.type === 'attack') {
        const { damage, dead } = outcome;
        if (character.enemy) {
          record[receiverId].damageReceived += damage;
        } else {
          record[characterId].damageDealt += damage;
          if (dead) {
            record[characterId].killed++;
          }
        }
      } else if (action.type === 'item') {
  
      }
    });
  });

  return record;
}

const applyEvents = (roomState) => {
  // the events queued to happen
  const allEvents = roomState.queuedEvents;
  // the events that we are going to apply and return
  let appliedEvents = [];

  // for each event queued
  for (let event of allEvents) {
    const {
      characterId,
      receiverId,
      action,
    } = event;

    let character = {...roomState.players, ...roomState.enemies}[characterId];
    let receiver = {...roomState.players, ...roomState.enemies}[receiverId];
    if (!character || !receiver) {
      continue;
    }

    if (receiver.entity.health === 0) {
      continue;
    }

    // action type switch
    switch(action.type) {
      case 'attack':
        let chosenAttack = character.entity.attacks[action.id];
        let damage = chosenAttack.stats.baseDamage // * criticalStrike * character.lvl / receiver.defense
        let outcome = {
          damage,
          dead: false
        };
        character.entity.energy -= chosenAttack.stats.energy;
        receiver.entity.health -= damage;
        if (receiver.entity.health <= 0) {
          receiver.entity.health = 0;
          outcome.dead = true;
        }

        appliedEvents.push({
          ...event,
          outcome,
        });
        break;
      case 'item':
        let chosenItem = character.entity.inventory[action.id];

        if (chosenItem.id === 'heal-potion') {
          character.entity.inventory[action.id].amount--;
          receiver.entity.health += 25;
          if (receiver.entity.health > receiver.entity.maxHealth) {
            receiver.entity.health = receiver.entity.maxHealth;
          }

          appliedEvents.push({
            ...event,
            outcome: {
              heal: 25,
            },
          });
        } else {
          console.error('Unknow potion id ', action.id);
        }
        break;
      default:
        continue;
    }
  }

  return appliedEvents;
}

const enemyTurn = (pathToRoom) => {
  /*
    Ideally each entity should have their own strategy for attacking and using potions

    Example:  
    Slimes choose random players to attack and only heal when they feel lucky
    Mages choose to attack the player that last attacked them, using potions and spells. They can heal when at low health
    Zombies bunch up on low health players and never heal
  */
  let state = JSON.parse(fs.readFileSync(pathToRoom));

  _.forEach(_.filter(state.enemies, e => e.entity.health > 0), enemy => setTimeout(() => {
    state = JSON.parse(fs.readFileSync(pathToRoom));
    // very simple AI strategy for the Slime entity
    let event = null;
    /*
      Heal IF...
      1. 50% of maxHealth is gone
      2. There is a potion available in inventory
      3. There is a 15% chance probability (random)
    */
    let healthDelta = enemy.entity.maxHealth - enemy.entity.health;

    if (healthDelta >= (enemy.entity.maxHealth * 0.5) && Math.random() <= 0.15 && enemy.entity.inventory['heal-potion']) {
      event = {
        characterId: enemy.id,
        receiverId: enemy.id,
        action: {
          type: 'potion',
          id: 'heal-potion',
        },
      }
    } else {
      // chose a random player (TODO: make sure they are not dead :))
      let ids = _.filter(state.players, player => player.entity.health > 0).map(p => p.id);
      let playerId = ids[Math.floor(Math.random() * ids.length)];

      // choose an attack that requires less energy than that of the current enemy entity.energy
      const { attacks } = enemy.entity;
      const attack = _.findKey(attacks, (atk) => atk.stats.energy <= enemy.entity.energy);
      
      if (playerId && attack) {
        event = {
          characterId: enemy.id,
          receiverId: playerId,
          action: {
            type: 'attack',
            id: attack,
          }
        }
      }
    }

    if (event) {
      state.queuedEvents.push(event);
    }

    state.enemies[enemy.id].selectionStatus = 1;

    fs.writeFileSync(pathToRoom, JSON.stringify(state));
  }, _.random(3500, 8000)));
}