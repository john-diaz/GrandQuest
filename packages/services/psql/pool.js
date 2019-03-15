const pg = require('pg');

const {
	DB_NAME,
	// production
	DB_HOST, 
} = process.env;

if (process.env.NODE_ENV === 'production') {
	console.log('Database running in production mode');
	console.log(`
	$ PSQ
	- NODE_ENV = production
	- host = "${DB_HOST}"
	`);
	module.exports = new pg.Pool({
		connectionString: process.env.DB_HOST,
	});
} else {
	console.log(`
	$ PSQL
	- NODE_ENV = development
	- database = '${DB_NAME}'
	`);
	module.exports = new pg.Pool({
	  database: process.env.DB_NAME,
	});
}
