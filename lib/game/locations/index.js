
let namespace = module.exports;
let io = require('socket.io')();

namespace = io.of('/game');

var gameLoop = null;

const initialState = {
  timeOfDay: 6500, // 0 - 24000, default: 6:30am
  readableTimeOfDay: '',
  messageHistory: [],
}

const readableTimeOfDay = () => {
  let currentTime = gameState.timeOfDay;
  var leftSide = Math.floor(currentTime / 1000)
  var rightSide = ((currentTime/1000 - leftSide) * 60).toFixed(0);
  var period = leftSide > 11 ? 'pm' : 'am';

  return `${leftSide}:${rightSide}${period}`
}

var gameState = null;

var stateUpdateInterval = { date: null, update: 400 };
var clientUpdateInterval = { date: null, update: 1000 };

const generateGameLoop = async () => {
  gameLoop = true;

  while(true) {
    const now = Date.now();

    // update the client
    if (now - clientUpdateInterval.date > clientUpdateInterval.update) {
      clientUpdateInterval.date = Date.now();
    }
    // update the state
    if (now - stateUpdateInterval.date > stateUpdateInterval.update) {
      // update time of day
      gameState.timeOfDay += 12;

      if (gameState.timeOfDay > 24000) {
        gameState.timeOfDay -= 24000;
      }
      gameState.readableTimeOfDay = readableTimeOfDay();

      stateUpdateInterval.date = Date.now()
    }
  }
  
  gameLoop = null;
  console.log('gameLoop ended');
}
const startGameLoop = () => {
  if (gameLoop) {
    throw new Error('Attempted to initiate game loop while one already ran');
  }

  stateUpdateInterval.date = 0;
  clientUpdateInterval.date  = 0;

  gameState = {...initialState};

  generateGameLoop();
}

const requireAuth = ({ socket }) => {
  const socketData = socketsState[socket.id];

  if (!socketData) {
    return socket.emit('ERROR', { message: 'You have not joined this namespace yet' });
  } else {
    next();
  }
}

namespace.use((socket, next) => {
  if (!!socket.gameData) {
    next();
  } else {
    socket.emit('ERROR', { message: 'Please join before emitting any events' });
  }
});

namespace.on('connect', async (socket) => {
  const jwt = '' // find jwt here

  const results = await pool.query('SELECT * FROM users WHERE token = $1', [jwt]);
  if (!results.rowCount) {
    return socket.emit('ERROR', { message: 'Invalid JWT provided' });
  }
  
  socket.gameData = {...results.rows[0]};
  console.log('user', socket.gameData);

  socket.on('join', () => {

  });
  socket.on('disconnect', () => {
    delete socket.gameData;
  });
});

startGameLoop();
