/* ./packages/engine/store.js */

class Store {
  constructor(initialState) {
    this.state = initialState;
    this.subscriptions = [];
  }
  update(storeKey, updateFn) {
    // update function
    const nextStoreState = updateFn(this.state[storeKey]);
    if (typeof nextStoreState !== 'object') {
      throw new Error('store.update function did not return an object. Got: ', nextStoreState);
    }
    // compare current with next state
    if (this.state[storeKey] !== nextStoreState) {
      let prev = {...this.state}
      // update state
      this.state[storeKey] = {...nextStoreState};
      // emit prev and current state to subscription callbacks
      this.subscriptions.forEach(f => f(prev, {...this.state}));
    }
  }
  subscribe (fn) {
    this.subscriptions.push(fn)
  }
  getState () {
    return {...this.state}
  }
}

const initialState = {
  places: {
    world: {
      timeOfDay: 0,
      connections: 0,
    },
    combat: {
      inCombat: 0,
      rooms: {},
    },
  },
  users: {},
}

const store = new Store({...initialState});

module.exports = store;
