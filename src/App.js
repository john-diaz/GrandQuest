import React, { Component } from 'react';
import './App.css';
import { Routes } from './components';

import { Provider } from 'react-redux';
import { createStore } from 'redux';
import reducers from './redux/reducers';

import { initUserData } from './redux/actions';

class App extends Component {
  componentWillMount() {
    const userData = {
      username: 'SkepDimi',
      level: 10
    };
    this.props.store.dispatch(initUserData(userData))
  }
  render(){
    return(
      <Provider store={createStore(reducers)}>
        <Routes />
      </Provider>
    )
  }
}

export default App;
