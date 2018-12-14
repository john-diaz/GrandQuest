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
  describe('GET /forum/:title', () => {
    let cacheKey;
    let forum;
    let boards;

    before(done => {
      pool.query('SELECT * FROM forum WHERE array_length(boards, 1) > 0', (err, results) => {
        if (err || !results.rowCount) {
          throw err || new Error('Could not find forums to test (must have alteast one board)');
        }

        forum = results.rows[0];
        pool.query('SELECT * FROM board WHERE forum_title = $1', [forum.title], (err, results) => {
          if (err || !results.rowCount) {
            throw err || new Error('Could not find boards to test');
          }
          boards = results.rows;

          cacheKey = `DB:FORUMS:${forum.title.toLowerCase()}`;

          done();
        });
      });
    });

    it('Should not have cached the forum', done => {
      redisClient.get(cacheKey, (err ,val) => {
        expect(val).to.be.null;
        done();
      });
    });
    it('Should return the forum', done => {
      chai.request(server)
          .get(`/forum/${forum.title}`)
          .end((err, res) => {
            let forumData = res.body.data;

            expect(forumData.title).to.equal(forum.title);
            console.log('boards ', boards);
            expect(forumData.boards).to.deep.equal(boards);
            done();
          });
    });
    it('Should have cached the forum', done => {
      redisClient.get(cacheKey, (err ,val) => {
        expect(val).not.to.be.null;
        done();
      });
    });
  });
});
