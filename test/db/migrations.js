process.env.NODE_ENV = 'test'

const chai = require('chai');
const { expect } = chai;
chai.should();

const server = require('../../index.js');

var pgtools = require('pgtools');

const pg = require('pg');
let pool;

const migrations = require('../../lib/db/migrations');

describe('Migrations testing', () => {
  before(async () => {
    const createDBQuery = migrations.shift();
    console.log('db name = ', process.env.DB_NAME);
    await pgtools.createdb({
      port: 5432,
      host: 'localhost',
    }, process.env.DB_NAME);

    pool = await new pg.Pool({
      database: process.env.DB_NAME,
    });
  });
  after(async () => {
    await pgtools.dropdb({}, process.env.DB_NAME);
    process.exit();
  });
  it('should create database by our specified db_name', () => {
    expect(migrations[0]).to.equal(`CREATE DATABASE ${process.env.DB_NAME};`);
  });
  describe('When ran', () => {
    before(done => {
      // this is to prevent an error when creating the database
      migrations.push('SET AUTOCOMMIT = ON');

      const queryMigration = migrations.join('\n ');
      pool.query(queryMigration, (err) => {
        if (err) throw err
        done();
      });
    });
    it('should create users', () => {

    });
  });
});