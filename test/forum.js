process.env.NODE_ENV = 'test';

const server = require('../index.js');
const pool = require('../lib/db/client');
const redisClient = require('../lib/redisClient');

let chai = require('chai');
let chaiHttp = require('chai-http');
chai.should();
let expect = chai.expect

chai.use(chaiHttp);

describe('Forum', () => {
  describe('GET /forum', () => {
    it('Should not have cached the forums', done => {
      redisClient.get('DB:FORUMS', (err, val) => {
        expect(val).to.be.null

        done();
      });
    });
    it('Should return all the forums available in the DB', done => {
      pool.query('SELECT * FROM forum', (err, results) => {
        if(err) throw err;

        chai.request(server)
            .get('/forum')
            .end((err, res) => {
              res.should.have.status(200);

              let { data } = res.body;

              data.should.be.an('array');
              data.should.deep.equal(results.rows);
              done();
            });
      });
    });
    it('Should cache the forums', done => {
      redisClient.get('DB:FORUMS', (err, val) => {
        const forums = JSON.parse(val);

        expect(forums).to.be.an('array');

        done();
      });
    });
  });
});
