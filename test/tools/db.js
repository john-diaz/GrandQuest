const pg = require('pg');

const TEST_DB = process.env.DB_NAME;

console.log('$ MOCHA - CONNECTING TO DB: ', TEST_DB);

const pool = new pg.Pool({
  database: TEST_DB,
});

module.exports = pool
