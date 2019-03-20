/* ./packages/engine/controllers/combatRoom.js */

const pool = require('../../services/psql/pool');
const uuid = require('uuid/v4');
const store = require('../store');
const _ = require('underscore');

const Entity = require('../../data/entities');

/*
  Export room creator function
  Will return a new roomState object
*/
module.exports = (data = {}) => {
  // Generate state
  const initialState = {
    // default data
    title: '',
    maxPlayers: 4,
    // custom data
    ...data,
    // non-customizable data
    gameRunning: false,
    id: uuid(),
    playerCount: 0,
    players: {},
    playState: 1, // 0 = pending to begin level, 1 = now playing
    // generate 4 enemies
    enemies: {},
    turn: 0,
    level: -1,
    queuedEvents: [],
    levelRecord: {},
    turnEvents: {},
    readyToContinue: {},
  }

  // game loop
  setInterval(() => {
    const room = store.getState().places.combat.rooms[initialState.id];

    // if there are players but game is not running then begin the first level
    if (!room.gameRunning) {
      if (room.playerCount) beginLevel(room, 1);
      return;
    }

    if (room.playState === 1) {
      const cat = room.turn % 2
      ? 'enemies'
      : 'players';
      const characters = room[cat];

      const takenAction = _.filter(characters, c => c.selectionStatus === 1);
      const alive = _.filter(characters, c => c.entity.health > 0);

      if (alive.length && takenAction.length >= alive.length) {
        const newRoom = advanceTurn(room.id);

        const activeCharacters = newRoom.turn % 2
          ? newRoom.enemies
          : newRoom.players;

        const newAlive = _.filter(activeCharacters, c => c.entity.health > 0);

        // IF the characters that are supposed to act are all dead,
        // then the level is over!
        if (!newAlive.length) {
          // create a record for the level
          let levelRecord = createLevelRecord(newRoom.id);
          newRoom.levelRecord[room.level] = levelRecord;
          newRoom.playState = 0;

          // reward players for completing the level
          // also prevents player from going broke
          const levelCompletionReward = 5 + (newRoom.level * levelRecord.won ? 5 : 2);

          levelRecord.players = _.mapObject(levelRecord.players, (playerRecord, playerId) => {
            const user = state.users[playerId];

            if (!user) {
              return;
            }

            const newGold = user.gold + levelCompletionReward;

            pool.query(`
              UPDATE users SET gold = ${newGold}
              WHERE id = ${playerId}
            `, (err) => { if (err) throw err });

            store.update('users', (users) => ({
              ...users,
              [user.id]: {
                ...users[user.id],
                gold: newGold,
              }
            }));

            // update in level record
            return {
              ...playerRecord,
              gold: playerRecord.gold + levelCompletionReward,
            };
          });

          const values = `values ${_.map(newRoom.players, p => `(${p.id})`).join(', ')}`

          pool.query(`
          UPDATE combatants AS c SET
            levels_played = levels_played + 1,
            ${
              levelRecord.won
                ? 'levels_won = levels_won + 1'
                : 'levels_lost = levels_lost + 1'
            }
          FROM (${values}) AS c2(id)
          WHERE c2.id = c.id
          RETURNING *
          `, (err) => {
            if (err) throw err;
          });
        } else if (newRoom.turn % 2) {
          enemyTurn(newRoom);
        }

        // update store with new room
        store.update('places', (places) => ({
          ...places,
          combat: {
            ...places.combat,
            rooms: {
              ...places.combat.rooms,
              [newRoom.id]: newRoom,
            },
          },
        }));
      }
    } else if (Object.keys(room.readyToContinue).length === room.playerCount) {
      beginLevel(room, room.level + 1);
    }
  }, 250);

  store.update('places', (places) => ({
    ...places,
    combat: {
      ...places.combat,
      rooms: {
        ...places.combat.rooms,
        [initialState.id]: {...initialState},
      },
    },
  }));
  return initialState;
}

const beginLevel = (roomState, level) => {
  const newRoomState = {
    ...roomState,
    gameRunning: true,
    level,
    levelRecord: {},
    players: _.mapObject(roomState.players, p => ({
      ...p,
      selectionStatus: 0,
      entity: {
        ...p.entity,
        energy: Math.ceil(p.entity.maxEnergy / 2),
      }
    })),
    enemies: generateLevelEnemies(level),
    turn: 0,
    playState: 1,
    turnEvents: {},
    queuedEvents: [],
    readyToContinue: {},
  }

  store.update('places', (places) => ({
    ...places,
    combat: {
      ...places.combat,
      rooms: {
        ...places.combat.rooms,
        [roomState.id]: newRoomState,
      },
    },
  }));
}
const generateLevelEnemies = (level) => {
  // 2 slimes
  if (level === 1) {
    return _.reduce([1, 2], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: 1,
          enemy: true,
          username: 'Slime',
          entity: Entity.Slime(),
          selectionStatus: -1,
          power: 1,
          defense: 1,
          xpReward: 4,
          goldReward: _.random(5, 10),
        }
      };
    }, {});
  }
  // 3 slimes
  else if (level <= 2) {
    return _.reduce([2, 3, 4], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: 1,
          enemy: true,
          username: 'Slime',
          entity: Entity.Slime(),
          selectionStatus: -1,
          power: 1,
          defense: 1,
          xpReward: 4,
          goldReward: _.random(6, 11),
        }
      };
    }, {});
  }
  // 4 slimes with random power
  else if (level <= 4) {
    return _.reduce([1, 2], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: 1,
          enemy: true,
          username: 'Slime',
          entity: Entity.Slime(),
          selectionStatus: -1,
          power: _.random(1, 3),
          defense: _.random(1, 3),
          goldReward: _.random(11, 16),
          xpReward: _.random(4, 6),
        },
      };
    }, {});
  }
  // 3 slimes 1 mountain warrior
  else if (level <= 6) {
    const e = [
      {
        id: uuid(),
        level: _.random(1, 4),
        enemy: true,
        username: 'Slime',
        entity: Entity.Slime(),
        selectionStatus: -1,
        power: _.random(1, 3),
        defense: _.random(1, 3),
        goldReward: _.random(12, 16),
        xpReward: _.random(4, 6),
      },
      {
        id: uuid(),
        level: _.random(1, 2),
        enemy: true,
        username: 'Slime',
        entity: Entity.Slime(),
        selectionStatus: -1,
        power: _.random(1, 3),
        defense: _.random(1, 3),
        goldReward: _.random(9, 12),
        xpReward: _.random(4, 6),
      },
      {
        id: uuid(),
        level: _.random(1, 2),
        enemy: true,
        username: 'Slime',
        entity: Entity.Slime(),
        selectionStatus: -1,
        power: _.random(1, 3),
        defense: _.random(1, 3),
        goldReward: _.random(9, 12),
        xpReward: 4,
      },
      {
        id: uuid(),
        level: _.random(2, 3),
        enemy: true,
        username: 'Warrior',
        entity: Entity.MountainWarrior(),
        selectionStatus: -1,
        power: _.random(1, 2),
        defense: _.random(1, 4),
        goldReward: _.random(10, 18),
        xpReward: _.random(7, 8),
      },
    ];

    return _.reduce(e, (m, c) => ({
      ...m,
      [c.id]: c
    }), {});
  }
  // 2 mountain warriors
  else if (level <= 7) {
    return _.reduce([1, 2], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: _.random(2, 4),
          enemy: true,
          username: 'Warrior',
          entity: Entity.MountainWarrior(),
          selectionStatus: -1,
          power: _.random(2, 2),
          defense: _.random(2, 4),
          goldReward: _.random(12, 24),
          xpReward: _.random(10, 15),
        },
      };
    }, {});
  }
  // 4 mountain warriors
  else if (level <= 10) {
    return _.reduce([1, 2, 3, 4], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: _.random(2, 4),
          enemy: true,
          username: 'Warrior',
          entity: Entity.MountainWarrior(),
          selectionStatus: -1,
          power: _.random(2, 2),
          defense: _.random(2, 4),
          goldReward: _.random(12, 24),
          xpReward: _.random(10, 15),
        },
      };
    }, {});
  }
  else if (level <= 15) {
    return _.reduce([1, 2, 3, 4], (m) => {
      const id = uuid();
      return {
        ...m,
        [id]: {
          id,
          level: _.random(2, 4),
          enemy: true,
          username: 'Warrior',
          entity: Entity.MountainWarrior(),
          selectionStatus: -1,
          power: _.random(2, 2),
          defense: _.random(2, 4),
          goldReward: _.random(12, 24),
          xpReward: _.random(10, 15),
        },
      };
    }, {});
  }
  else if (level <= 16) {
    // 1 mountain warrios, 1 mutants
  }
  else if (level <= 18) {
    // 2 mountain warriors / 2 mutants
  }
  else if (level <= 20) {
    // 4 mutants
  }
  else if (level <= 25) {
    // 2 mutants and 1 golem
  }
  else if (level < 30) {
    // 4 golems
  }
  else if (level === 30) {
    // BOSS
  }
  else {
    // random enemies
  }
}
const createLevelRecord = (id) => {
  let roomState = store.getState().places.combat.rooms[id];

  const record = {
    won: false,
    players: {},
  };

  // if there are players alive, set record.won = true
  if (_.filter(roomState.players, p => p.entity.health > 0).length) {
    record.won = true;
  }

  // generates a record for the players based on all events
  _.forEach(roomState.turnEvents, (turnEvents) => {
    _.forEach(turnEvents, (event) => {
      const {
        action,
        outcome,
      } = event;

      if (event.character.enemy && event.receiver.enemy) {
        return;
      }

      const character = {...roomState.players, ...roomState.enemies}[event.character.id];
      const receiver = {...roomState.players, ...roomState.enemies}[event.receiver.id];

      if (!character || !receiver)  {
        return;
      }

      // find the id for the player in the event
      let playerId = !character.enemy
        ? character.id
        : receiver.id;

      // if there is no record for this player yet, creates one
      if (!record.players[playerId]) {
        record.players[playerId] = {
          damageDealt: 0,
          gold: 0,
          xp: 0,
        };
      }

      if (action.type === 'attack') {
        const { damage, dead, xp, gold } = outcome;
        if (!character.enemy) {
          record.players[playerId].damageDealt += Math.round(damage);
          if (dead) {
            record.players[playerId].xp += xp;
            record.players[playerId].gold += gold;
          }
        }
      }
    });
  });

  return record;
}

const advanceTurn = (id) => {
  const state = store.getState();
  const roomState = state.places.combat.rooms[id];
  let newRoom = {...roomState};

  // where we will store the turn events
  newRoom.turnEvents[newRoom.turn] = [];

  // for each event queued
  for (let event of roomState.queuedEvents) {
    const { action } = event;

    let characterCategory = event.character.enemy
      ? 'enemies'
      : 'players';

    let receiverCategory = event.receiver.enemy
      ? 'enemies'
      : 'players';

    let character = newRoom[characterCategory][event.character.id];
    let receiver = newRoom[receiverCategory][event.receiver.id];

    // skip if the character or receiver are not present of the receiver is dead
    if (!character || !receiver || receiver.entity.health === 0) {
      continue;
    }

    // action type switch
    switch(action.type) {
      case 'attack':
        let chosenAttack = character.entity.attacks[action.id];

        const baseDamage = (character.power / receiver.defense) * chosenAttack.stats.baseDamage;

        // random number between 1 - 3
        let multiplier = _.random(1, 3);

        // miss 12% of the time
        if (Math.random() < .12) {
          multiplier = 0;
        }

        // random number between 0.85 and 1
        const random = (Math.floor(Math.random() * (100 - 85 + 1)) + 85) / 100;

        // calculate damage and round to tenth
        let damage = Math.round((baseDamage * multiplier * random) * 10) / 10;

        let outcome = {
          attackBase: chosenAttack.stats.baseDamage,
          damage,
          dead: false,
          gold: 0,
          xp: 0,
        };

        // take away energy from character in newRoom
        newRoom[characterCategory][character.id].entity = {
          ...character.entity,
          energy: character.entity.energy - chosenAttack.stats.energy,
        };

        // take away health from receiver in newRoom
        newRoom[receiverCategory][receiver.id].entity = {
          ...receiver.entity,
          health: Math.round(Math.max(receiver.entity.health - damage, 0)),
        };

        // if the attack receiver is a player, save their new health to the database
        if (!receiver.enemy) {
          pool.query(`
            UPDATE combatants SET
              health = ${receiver.entity.health}
            WHERE id = ${receiver.id}
          `, (err) => {
            if (err) throw err;
          });
        }

        // if we killed the receiver
        if (receiver.entity.health === 0) {
          outcome.dead = true;

          // if the character is a player
          if (!character.enemy) {
            /* add xp and gold to outcome */
            outcome.gold = receiver.goldReward;
            outcome.xp = receiver.xpReward;

            /* save changes to player */

            const user = state.users[character.id];
            if (!user) throw new Error('Could not find user in state.users with id' + character.id);

            let leveledUp = 0;
            let newXp = user.xp + outcome.xp;
            let newNextLevelXp = user.nextLevelXp;

            // level up time!
            console.log(newXp, ' >= ', user.nextLevelXp);
            if (newXp >= user.nextLevelXp) {
              leveledUp = Math.floor(newXp / user.nextLevelXp);
              newXp = newXp % user.nextLevelXp;
              newNextLevelXp = Math.floor(user.nextLevelXp * (9/5));
            }

            const newLevel = user.level + leveledUp;
            const newGold = user.gold + outcome.gold;

            console.log(`
              UPDATE users SET
                gold = ${newGold},
                level = ${newLevel},
                xp = ${newXp},
                next_level_xp = ${newNextLevelXp}
              WHERE id = ${character.id}
              RETURNING *
            `);
            pool.query(`
              UPDATE users SET
                gold = ${newGold},
                level = ${newLevel},
                xp = ${newXp},
                next_level_xp = ${newNextLevelXp}
              WHERE id = ${character.id}
              RETURNING *
            `, (err, results) => { if (err) throw err });

            store.update('users', (users) => ({
              ...users,
              [character.id]: {
                ...users[character.id],
                gold: newGold,
                level: newLevel,
                xp: newXp,
                nextLevelXp: newNextLevelXp,
              },
            }));
          }
        }

        newRoom.turnEvents[newRoom.turn].push({
          ...event,
          outcome,
        });
        break;
      case 'item':
        const inventory = character.inventory;
        const chosenItem = inventory[action.id];

        if (chosenItem.id === 'heal-potion') {
          receiver.entity.health = Math.min(receiver.entity.health + 25, receiver.entity.maxHealth);

          if (!receiver.enemy) {
            pool.query(`
              UPDATE combatants SET
                health = ${receiver.entity.health}
              WHERE id = ${receiver.id}
            `, (err) => {
              if (err) {
                throw err;
              }
            });
          }

          newRoom.turnEvents[newRoom.turn].push({
            ...event,
            outcome: {
              heal: 25,
            },
          });
        } else if (chosenItem.id === 'heal-potion-2') {
          receiver.entity.health = Math.min(receiver.entity.health + 50, receiver.entity.maxHealth);

          if (!receiver.enemy) {
            pool.query(`
              UPDATE combatants SET
                health = ${receiver.entity.health}
              WHERE id = ${receiver.id}
            `, (err) => {
              if (err) {
                throw err;
              }
            });
          }

          newRoom.turnEvents[newRoom.turn].push({
            ...event,
            outcome: {
              heal: 50,
            },
          });
        } else {
          return console.error('Unknow potion id ', action.id);
        }

        // chose the first uid
        const uid = chosenItem.uids[0];

        const newItem = {
          ...chosenItem,
          uids: chosenItem.uids.filter(u => u !== uid),
        }

        // omits the item in the inventory IF there are no more uids in the item
        const newInventory = newItem.uids.length > 0
        ? {
          ...inventory,
          [newItem.id]: newItem,
        }
        : _.omit(inventory, newItem.id);

        newRoom.players[character.id].inventory = newInventory;

        pool.query(`DELETE FROM user_inventory WHERE uid = ${uid}`, (err) => {
          if (err) throw err;
        });
        break;
      default:
        continue;
    }
  }

  const category = newRoom.turn % 2
    ? 'enemies'
    : 'players';
  const nextCategory = category === 'enemies'
    ? 'players'
    : 'enemies';
  // set selection status for characters that just chose
  newRoom[category] = _.mapObject(newRoom[category], c => ({
    ...c,
    selectionStatus: -1,
  }));
  // set selection status and energy for characters now choosing
  newRoom[nextCategory] = _.mapObject(newRoom[nextCategory], c => ({
    ...c,
    selectionStatus: c.entity.health > 0 ? 0 : -1,
    entity: {
      ...c.entity,
      energy: Math.min(c.entity.energy + c.entity.energyRate, c.entity.maxEnergy),
    }
  }));

  newRoom.queuedEvents = [];
  newRoom.turn++;

  return newRoom;
}

const enemyTurn = (roomState) => {
  /*
    Ideally each entity should have their own strategy for attacking and using potions

    Example:  
    Slimes choose random players to attack and only heal when they feel lucky
    Mages choose to attack the player that last attacked them, using potions and spells. They can heal when at low health
    Zombies bunch up on low health players and never heal
  */

  console.log('enemy turn!');

  _.forEach(_.filter(roomState.enemies, e => e.entity.health > 0), enemy => setTimeout(() => {
    state = store.getState();
    roomState = state.places.combat.rooms[roomState.id];
    if (!roomState.gameRunning) return;
    // very simple AI strategy for the Slime entity
    let event = null;

    let ids = _.filter(roomState.players, player => player.entity.health > 0).map(p => p.id);
    let playerId = ids[Math.floor(Math.random() * ids.length)];

    // choose an attack that requires less energy than that of the current enemy entity.energy
    const attack = _.findKey(enemy.entity.attacks, (atk) => atk.stats.energy <= enemy.entity.energy);

    console.log('attack', attack);
    console.log('energy = ', enemy.entity.energy);
    if (playerId && attack) {
      event = {
        character: {
          id: enemy.id,
          enemy: true,
        },
        receiver: {
          id: playerId,
          enemy: false
        },
        action: {
          type: 'attack',
          id: attack,
        }
      }
    }

    if (event) {
      roomState.queuedEvents.push(event);
    }

    roomState.enemies[enemy.id].selectionStatus = 1;

    store.update('places', (places) => ({
      ...places,
      combat: {
        ...places.combat,
        rooms: {
          ...places.combat.rooms,
          [roomState.id]: roomState,
        }
      },
    }));
    console.log('enemy done', event);
  }, _.random(100, 2000)));
}