const pg = require('pg');

console.log('$ POSTGRES : connecting to database ', process.env.DB_NAME);

const pool = new pg.Pool({
  database: process.env.DB_NAME,
});

module.exports = pool
