const redux = require('redux');

const initialState = {
  timeOfDay: 6500, // 0 - 24000
  readableTimeOfDay: '6:30am',
  users: {},
  connections: 0,
}

const reducer = function(state = initialState, action) {
  let newState = { ...state };

  switch(action.type) {
    case 'SET_CONNECTIONS':
      newState.connections = action.payload;
      return newState;
    case 'DISCONNECT_USER':
      // remove player if they are authenticated
      if (action.payload.userID) {
        delete newState.users[action.payload.userID];
      }
      return newState;
    case 'ADD_TICK':
      newState.timeOfDay = state.timeOfDay + 6.9444444
      
      if (newState.timeOfDay > 24000) {
        newState.timeOfDay -= 24000;
      }
      let militaryTime = Math.floor(state.timeOfDay / 1000);
      let leftSide = militaryTime > 12 ? militaryTime - 12 : militaryTime;
      let rightSide = ((state.timeOfDay/1000 - leftSide) * 60).toFixed(0);

      let period = militaryTime > 12 ? 'am' : 'pm';
      
      newState.readableTimeOfDay = `${leftSide}:${rightSide}${period}`;

      return newState
    case 'ADD_USER':
      newState.users[action.payload.id] = {...action.payload};
      return newState;
    default:
      return state
  }
}

const store = redux.createStore(reducer)

module.exports = store