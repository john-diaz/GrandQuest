/* ./lib/game/world/room.js */

const pool = require('../../../db/client');
const uuid = require('uuid/v4');
const store = require('../../store');
const _ = require('underscore');

const items = require('../../definitions/items');
const Entity = require('../../definitions/entities');

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
      if (room.playerCount) beginLevel(room, 0);
      return;
    }

    if (room.playState === 1) {
      const cat = room.turn % 2
      ? 'enemies'
      : 'players';
      const characters = room[cat];
      const nextCat = cat === 'enemies'
      ? 'players'
      : 'enemies';

      const takenAction = _.filter(characters, c => c.selectionStatus === 1);
      const alive = _.filter(characters, c => c.entity.health > 0);
      if (alive.length && takenAction.length >= alive.length) {
        const appliedEvents = applyEvents(room);

        room.turnEvents[room.turn] = appliedEvents;
        room.queuedEvents = [];
        room.turn++;
        
        // set selection status for characters that just chose
        room[cat] = _.mapObject(room[cat], c => ({
          ...c,
          selectionStatus: -1,
        }));
        // set selection status and energy for characters now choosing
        room[nextCat] = _.mapObject(room[nextCat], c => {
          let newEnergy = c.entity.energy + c.entity.energyRate;
          return {
            ...c,
            selectionStatus: c.entity.health > 0 ? 0 : -1,
            entity: {
              ...c.entity,
              energy: newEnergy >= c.entity.maxEnergy ? c.entity.maxEnergy : newEnergy,
            },
          }
        });
          
        const alive = _.filter(room[nextCat], c => c.entity.health > 0);
        if (!alive.length) {// this level is over! record everything!
          console.log(`no more ${nextCat} alive to attack! `, nextCat === 'players' ? 'Gameover!' : 'Success!');
          let levelRecord = saveLevelChanges(room);
          room.levelRecord[room.level] = levelRecord;
          room.playState = 0;
        }
          
        // save changes done
        store.update('places', (places) => ({
          ...places,
          combat: {
            ...places.combat,
            rooms: {
              ...places.combat.rooms,
              [room.id]: room,
            }
          }
        }));

        // it's time for enemies to attack AND there are enemies alive
        if (alive.length && room.turn % 2) {
          console.log('enemy turn');
          enemyTurn(room);
        }
      }
    } else {
      if (Object.keys(room.readyToContinue).length === room.playerCount) {
        // beginLevel(room, room.level + 1);
      }
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
const generateLevelEnemies = (lvl) => {
  switch(lvl) {
    case 0:
    // level 0: 4 Slime enemies
      return _.reduce([1, 2, 3, 4], (m) => {
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
          }
        };
      }, {});
    case 1:
    //level 1: 3 Slime enemies, 1 ... enemy
    return _.reduce([1,2,3,4], (m, i) => {
      const id = uuid();
      const entityName = i !== 4 ? 'Slime' : 'Something else';

      return {
        ...m,
        [id]: {
          id,
          level: 3,
          enemy: true,
          username: entityName,
          entity: Entity.Slime(),
          selectionStatus: -1,
          power: 1,
          defense: 2,
        }
      }
    }, {});
    default:
      return {};
  }
}
const saveLevelChanges = (roomState) => {
  let state = store.getState();
  const record = {
    won: false,
    players: {},
  };

  // if there are players alive, set record.won = true
  if (_.filter(roomState.players, p => p.entity.health > 0).length) {
    record.won = true;
  }

  // generates a record for the players
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
      // if the character is a player and he is not
      let playerId = !character.enemy
        ? characterId
        : receiverId;
      if (!record.players[playerId]) {
        record.players[playerId] = {
          damageDealt: 0,
          gold: 0,
          xp: 0,
        };
      }
      if (action.type === 'attack') {
        const { damage, dead, xp } = outcome;
        if (!character.enemy) {
          record.players[characterId].damageDealt += Math.round(damage);
          record.players[characterId].xp += xp;
          if (dead) {
            const goldReward = receiver.entity.name == 'slime'
            ? 4
            : receiver.entity.name === 'something else'
            ? 10
            : 0;

            record.players[characterId].gold += goldReward;
          }
        }
      }
    });
  });

  const turnsReward = !record.won
    ? 0
    : roomState.turn <= 4
    ? 50
    : roomState.turn <= 10
    ? 15
    : roomState.turn <= 20
    ? 5
    : 0;

  // apply record to players on store
  _.forEach(record.players, (userRecord, id) => {
    const damageDelta = userRecord.damageDealt - userRecord.damageReceived;
    if (damageDelta > 0) {
      userRecord.gold += damageDelta * 2;
    }
    userRecord.gold += turnsReward;

    // save player changes to store
    const player = state.players[id];
    pool.query(`
      UPDATE users SET
        gold = gold + ${userRecord.gold}
      WHERE id = ${player.id}
      RETURNING *
    `)
    .then((results) => {
      store.update('players', (players) => ({
        ...players,
        [id]: {
          ...player,
          gold: Number(results.rows[0].gold),
        },
      }));
    })
    .catch((err) => {
      throw err;
    });
  });

  const values = `values ${_.map(roomState.players, p => `(${p.id}, ${p.entity.health})`).join(', ')}`

  pool.query(`
  UPDATE combatants AS c SET
    levels_played = levels_played + 1,
    health = c2.health
  FROM (${values}) AS c2(id, health)
  WHERE c2.id = c.id
  RETURNING *
  `, (err) => {
    if (err) throw err;
    console.log('saved combatants data to database');
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

        const baseDamage = ((character.level / 12) + 1) * (character.power / receiver.defense) * chosenAttack.stats.baseDamage;
        // random number between 0 - 3
        let multiplier = Math.floor(Math.random() * 3) + 1;
        // miss 15% of the time
        if (Math.random() < .15) {
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
          xp: 0,
        };
        character.entity.energy -= chosenAttack.stats.energy;
        receiver.entity.health = Math.round(Math.max(receiver.entity.health - damage, 0));
        if (receiver.entity.health === 0) {
          outcome.dead = true;

          // if the character is a player
          if (!character.enemy) {
            let player = store.getState().players[character.id];
            outcome.xp = receiver.entity.xp;

            let leveled = 0;

            let newXp = player.xp + receiver.entity.xp;
            let newNextLevelXp = player.nextLevelXp;

            // level up time!
            if (newXp >= player.nextLevelXp) {
              leveled = Math.floor(player.xp / player.nextLevelXp);
              newXp = player.xp % player.nextLevelXp;
              newNextLevelXp = (Math.floor(Math.floor(player.nextLevelXp * (9/5))/50)) * 50;
            }

            pool.query(`
              UPDATE users SET
                level = ${player.level + leveled},
                xp = ${newXp},
                next_level_xp = ${newNextLevelXp}
              WHERE id = ${player.id}
              RETURNING *
            `)
            .then((results) => {
              const dbPlayer = results.rows[0];
              console.log('dbPlayer', dbPlayer);
              store.update('players', (players) => ({
                ...players,
                [player.id]: {
                  ...player,
                  gold: Number(dbPlayer.gold),
                  level: dbPlayer.level,
                  xp: dbPlayer.xp,
                  newNextLevelXp: dbPlayer.next_level_xp,
                },
              }));
            })
            .catch((err) => {
              throw err;
            });
          }
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
      let ids = _.filter(roomState.players, player => player.entity.health > 0).map(p => p.id);
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
    console.log('enemy done');
  }, _.random(100, 2000)));
}