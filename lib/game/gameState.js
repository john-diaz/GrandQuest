const redux = require('redux');

const initialState = {
  timeOfDay: 6500, // 0 - 24000
  readableTimeOfDay: '6:30am',
  connections: {},
}

const reducer = function(state = initialState, action) {
  let newState = { ...state };

  switch(action.type) {
    case 'CONNECT_USER':
      newState.connections[action.payload] = Date.now();
      return newState;
    case 'DISCONNECT_USER':
      delete newState.connections[action.payload];
      return newState;
    case 'ADD_TICK':
      newState.timeOfDay = state.timeOfDay + 6.9444444
      
      if (newState.timeOfDay > 24000) {
        newState.timeOfDay -= 24000;
      }
      let leftSide = Math.floor(state.timeOfDay / 1000);
      let rightSide = ((state.timeOfDay/1000 - leftSide) * 60).toFixed(0);

      let period = leftSide > 11 ? 'pm' : 'am';
      
      newState.readableTimeOfDay = `${leftSide}:${rightSide}${period}`;

      return newState
    default:
      return state
  }
}

const store = redux.createStore(reducer)

module.exports = store