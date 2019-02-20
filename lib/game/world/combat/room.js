/* ./lib/game/world/room.js */

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

  store.subscribe((prevState, state) => {
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
  });

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
    turnEvents: {},
    queuedEvents: [],
    readyToContinue: {},
  }

  console.log('start level');
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
            enemy: true,
            username: 'Slime',
            entity: Entity.Slime(),
            selectionStatus: -1,
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
          enemy: true,
          username: entityName,
          entity: Entity.Slime(),
          selectionStatus: -1,
        }
      }
    }, {});
    default:
      return {};
  }
}
const saveLevelChanges = (roomState) => {
  let state = store.getState();
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
      // if the character is a player and he is not
      let playerId = !character.enemy
        ? characterId
        : receiverId;
      if (!record[playerId]) {
        record[playerId] = {
          damageDealt: 0,
          gold: 0,
          xp: 0,
        };
      }
      if (action.type === 'attack') {
        const { damage, dead, xp } = outcome;
        if (!character.enemy) {
          record[characterId].damageDealt += damage;
          record[characterId].xp += xp;
          if (dead) {
            const goldReward = receiver.entity.name == 'slime'
            ? 4
            : receiver.entity.name === 'something else'
            ? 10
            : 0;

            record[characterId].gold += goldReward;
          }
        }
      }
    });
  });

  const turnsReward = roomState.turn <= 4
    ? 50
    : roomState.turn <= 10
    ? 15
    : roomState.turn <= 20
    ? 5
    : 0;

  // apply record to players on store
  _.forEach(record, (userRecord, id) => {
    const damageDelta = userRecord.damageDealt - userRecord.damageReceived;
    if (damageDelta > 0) {
      userRecord.gold += damageDelta * 2;
    }
    userRecord.gold += turnsReward;

    // save player changes to store
    let player = state.players[id];
    const weapon = items[player.weapon_id];
    player.gold += userRecord.gold;
    store.update('players', (players) => ({
      ...players,
      [id]: player,
    }));
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

        if (character.weapon_id) {
          const weapon = items[character.weapon_id];
          if (!weapon) {
            throw new Error('No weapon found for id', character.weapon_id);
          }
          damage += weapon.stats.baseDamage;
        }
        let outcome = {
          damage,
          dead: false
        };
        // if the character is a player, add xp based on the enemy character
        if (!character.enemy) {
          const xp = receiver.entity.name === 'slime'
            ? 5
            : 0;
          outcome.xp = xp;
          character.xp += xp
          // determine if they leveled up
          const maxXP = character.level === 1
            ? 55
            : character.level === 2
            ? 175
            : 0;
          if (character.xp >= maxXP) {
            const leveled = Math.floor(character.xp/maxXP);
            const remainder = character.xp%maxXP;
            character.level += leveled;
            character.xp = remainder;
          }
        }
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
  }, _.random(3500, 8000)));
}