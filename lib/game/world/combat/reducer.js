const initialState = {
  feed: [],
}

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case 'ADD_FEED':
      return state;
    default:
      return state;
  }
}

module.exports = reducer;
