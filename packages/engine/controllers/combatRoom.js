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
module.exports = (namespace) => (data = {}) => {
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
    const state = store.getState();
    const room = state.places.combat.rooms[initialState.id];

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
        advanceTurn(room.id);
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
      entity: {
        ...p.entity,
        energy: p.entity.maxEnergy,
      },
      selectionStatus: 0,
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
          xp: 4,
          gold: _.random(1, 3),
        }
      };
    }, {});
  }
  // 3-4 slimes
  else if (level <= 2) {
    return _.reduce([3, Math.floor(Math.random() * 4 + 3)], (m) => {
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
          xp: 4,
          gold: _.random(1, 2),
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
          gold: _.random(3, 4),
          xp: _.random(4, 6),
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
        gold: _.random(1, 2),
        xp: _.random(4, 6),
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
        gold: _.random(1, 2),
        xp: _.random(4, 5),
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
        gold: _.random(1, 2),
        xp: 4,
      },
      {
        id: uuid(),
        level: _.random(2, 3),
        enemy: true,
        username: 'Monokai Warrior',
        entity: Entity.MountainWarrior(),
        selectionStatus: -1,
        power: _.random(1, 2),
        defense: _.random(1, 4),
        gold: _.random(3, 5),
        xp: _.random(5, 7),
      },
    ];

    return _.reduce(e, (m, c) => ({
      ...m,
      [c.id]: c
    }), {});
  }
  else if (level <= 7) {
    // slimes and mountain warrior
  }
  else if (level <= 10) {
    // mountain warriors
  }
  else if (level <= 15) {
    // 3 mountain warriors, 1 mutants
  }
  else if (level <= 16) {
    // 2 mountain warrios, 2 mutants
  }
  else if (level <= 18) {
    // mountain warriors / mutants
  }
  else if (level <= 20) {
    // mutants
  }
  else if (level <= 25) {
    // mutants and golems
  }
  else if (level < 30) {
    // golems
  }
  else if (level === 30) {
    // BOSS
  }
  else {
    // random enemies
  }
}
const applyLevelOutcomes = (id) => {
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

  const values = `values ${_.map(roomState.players, p => `(${p.id})`).join(', ')}`

  pool.query(`
  UPDATE combatants AS c SET
    levels_played = levels_played + 1,
    ${
      record.won
        ? 'levels_won = levels_won + 1'
        : 'levels_lost = levels_lost + 1'
    }
  FROM (${values}) AS c2(id)
  WHERE c2.id = c.id
  RETURNING *
  `, (err) => {
    if (err) throw err;
    // console.log('saved level completion data to database');
  });

  return record;
}

const advanceTurn = (id) => {
  const roomState = store.getState().places.combat.rooms[id];
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

        const baseDamage = ((character.level / 12) + 1) * (character.power / receiver.defense) * chosenAttack.stats.baseDamage;
        // random number between 0 - 3
        let multiplier = Math.floor(Math.random() * 3) + 1;
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
            outcome.gold = receiver.gold;
            outcome.xp = receiver.xp;

            /* save changes to player */
            newRoom.players[character.id].gold = character.gold + outcome.gold;

            let leveledUp = 0;

            let newXp = character.xp + outcome.xp;
            let newNextLevelXp = character.nextLevelXp;

            // level up time!
            if (newXp >= character.nextLevelXp) {
              // console.log('level up!', newXp,'>=', character.nextLevelXp)
              leveledUp = Math.floor(newXp / character.nextLevelXp);
              newXp = character.xp % character.nextLevelXp;
              newNextLevelXp = Math.floor(character.nextLevelXp * (9/5));
            }

            character = newRoom.players[character.id] = {
              ...character,
              level: character.level + leveledUp,
              xp: newXp,
              nextLevelXp: newNextLevelXp,
            }

            pool.query(`
              UPDATE users SET
                gold = ${character.gold},
                level = ${character.level},
                xp = ${character.xp},
                next_level_xp = ${character.nextLevelXp}
              WHERE id = ${character.id}
              RETURNING *
            `, (err, results) => {
              if (err) {
                throw err;
              }

              const dbPlayer = results.rows[0];

              store.update('players', (players) => ({
                ...players,
                [character.id]: {
                  ...players[character.id],
                  gold: Number(dbPlayer.gold),
                  level: dbPlayer.level,
                  xp: dbPlayer.xp,
                  nextLevelXp: dbPlayer.next_level_xp,
                },
              }));
            });
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
              } else {
                console.log('set health in DB to ', receiver.entity.health);
              }
            });
          }

          newRoom.turnEvents[newRoom.turn].push({
            ...event,
            outcome: {
              heal: 25,
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

  const alive = _.filter(newRoom[nextCategory], c => c.entity.health > 0);
  if (!alive.length) {// this level is over! record everything!
    let levelRecord = applyLevelOutcomes(newRoom.id);
    newRoom.levelRecord[roomState.level] = levelRecord;
    newRoom.playState = 0;
  }

  newRoom.queuedEvents = [];
  newRoom.turn++;


  // save changes done
  store.update('places', (places) => ({
    ...places,
    combat: {
      ...places.combat,
      rooms: {
        ...places.combat.rooms,
        [roomState.id]: newRoom,
      }
    }
  }));

  // it's time for enemies to attack AND there are enemies alive
  if (alive.length && newRoom.turn % 2) {
    enemyTurn(newRoom);
  }
}

const enemyTurn = (roomState) => {
  /*
    Ideally each entity should have their own strategy for attacking and using potions

    Example:  
    Slimes choose random players to attack and only heal when they feel lucky
    Mages choose to attack the player that last attacked them, using potions and spells. They can heal when at low health
    Zombies bunch up on low health players and never heal
  */

  _.forEach(_.filter(roomState.enemies, e => e.entity.health > 0), enemy => setTimeout(() => {
    state = store.getState();
    roomState = state.places.combat.rooms[roomState.id];
    if (!roomState.gameRunning) return;
    // very simple AI strategy for the Slime entity
    let event = null;
    /*
      Heal IF...
      1. 50% of maxHealth is gone
      2. There is a potion available in inventory
      3. There is a 15% chance probability (random)
    */
    let healthDelta = enemy.entity.maxHealth - enemy.entity.health;

    if (healthDelta >= (enemy.entity.maxHealth * 0.5) && Math.random() <= 0.15 && enemy.inventory['heal-potion']) {
      event = {
        characterId: enemy.id,
        receiverId: enemy.id,
        action: {
          type: 'potion',
          id: 'heal-potion',
        },
      }
    } else {
      let ids = _.filter(roomState.players, player => player.entity.health > 0).map(p => p.id);
      let playerId = ids[Math.floor(Math.random() * ids.length)];

      // choose an attack that requires less energy than that of the current enemy entity.energy
      const { attacks } = enemy.entity;
      const attack = _.findKey(attacks, (atk) => atk.stats.energy <= enemy.entity.energy);

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
    // console.log('enemy done');
  }, _.random(100, 2000)));
}