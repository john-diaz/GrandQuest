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
    // generate 4 enemies
    enemies: _.reduce([1,2,3,4], (memo) => {
      const id = uuid();
      return {
        ...memo,
        [id]: {
          id,
          enemy: true,
          username: 'Slime',
          entity: Slime(),
          selectionStatus: 0,
        }
      };
    }, {}),
    turn: 0,
    level: 0,
    takenAction: 0,
    queuedEvents: [],
    turnEvents: {},
  }

  const pathToRoom = path.join(pathToCombatRooms, `${roomState.id}.json`);

  // Maybe we can create an observer and update combat rooms files on change???
  setInterval(() => {
    let state = JSON.parse(fs.readFileSync(pathToRoom, 'utf8'));

    // Player turn
    if (state.turn % 2 === 0 && state.playerCount > 0) {
      if(state.takenAction === state.playerCount) {
        // apply the events to the room state
        const appliedEvents = applyEvents(state);

        // save the applied events to this turn in state
        state.turnEvents[state.turn] = [
          ...appliedEvents
        ];

        // reset events array
        state.queuedEvents = []

        // IF game NOT done
        state.turn += 1
        enemyTurn();
        // ELSE 
        //   nsp.emit game.ending
      }
    }

    // save any changes done
    fs.writeFileSync(pathToRoom, JSON.stringify(state));
  
    // Emit game state to connected players
    if (state.playerCount) {
      namespace.to(state.id).emit('COMBAT_ROOM_STATE', state);
    }
  }, 1000);

  fs.writeFileSync(pathToRoom, JSON.stringify(roomState));
  return roomState;
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

    console.log('event.action ', action);

    const character = {...roomState.players, ...roomState.enemies}[characterId];
    const receiver = {...roomState.players, ...roomState.enemies}[receiverId];
    if (!character || !receiver) {
      continue;
    }

    if (receiver.isDead) {
      continue;
    }

    // action type switch
    switch(action.type) {
      case 'attack':
        let chosenAttack = character.entity.attacks[action.id];
        let damage = chosenAttack.stats.baseDamage // * criticalStrike * character.lvl

        receiver.entity.health -= damage
        if (receiver.entity.health <= 0) {
          receiver.entity = {
            ...receiver.entity,
            isDead: true,
            health: 0,
          }
        }

        appliedEvents.push({
          ...event,
          outcome: {
            damage,
          },
        });
        break;
      case 'potion':
        // potion action ...
        break;
      default:
        continue;
    }
  }

  console.log('applied = ', appliedEvents);
  return appliedEvents;
}

const enemyTurn = () => {
  console.log('Enemies now chooshing...');
}