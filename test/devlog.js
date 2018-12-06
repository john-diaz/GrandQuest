process.env.NODE_ENV = 'test';

const server = require('../index.js');
const s3 = require('../lib/s3-client');
const pool = require('../lib/db/client');
const redisClient = require('../lib/redisClient');

let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();
let expect = chai.expect

chai.use(chaiHttp);

describe('DevLog', () => {
  beforeEach((done) => {
    done();
  });

  describe('GET /devlog', () => {
    it('should receive an HTML file', (done) => {
      chai.request(server)
        .get('/devlog')
        .end((err, res) => {
          res.should.have.status(200);
          res.type.should.be.eql('text/html');

          done();
        });
    });
  });

  describe('GET /api/devlog', () => {
    it('should not be cached', (done) => {
      redisClient.get(`DB:DEV_LOG`, (err, val) => {
        expect(val).to.be.null
        done()
      });
    });
    it('should receive the chosen devlog HTML', (done) => {
      chai.request(server)
        .get(`/api/devlog`)
        .end((err, res) => {
          let body = res.body

          expect(body.data).to.be.an('Array');
          done()
        });
    });
    it('should cache the devlogs', (done) => {
      redisClient.get(`DB:DEV_LOG`, (err, val) => {
        expect(val).to.be.string
        done()
      });
    });
  });
  describe('GET /api/devlog/:id', () => {
    var devLog;
    var expectedHTML;

    before((done) => {
      const query = 'INSERT INTO dev_log (title, log_url) VALUES($1, $2) RETURNING *'
      const values = ["example log", "week1.html"]

      pool.query(query, values, async (err, results) => {
        if (err) throw err
        devLog = results.rows[0];
  
        const { Body } = await s3.getObject({
          Bucket: 'grandquest-devlog',
          Key: devLog.log_url,
        }).promise();
  
        expectedHTML = Body.toString();
        done();
      });
    });

    it('should not be cached', (done) => {
      redisClient.get(`DB:DEV_LOG:${devLog.id}`, (err, val) => {
        expect(val).to.be.null
        done()
      });
    });
    it('should receive the chosen devlog HTML', (done) => {
      chai.request(server)
        .get(`/api/devlog/${devLog.id}`)
        .end((err, res) => {
          res.body.data.html.should.eq(expectedHTML);
          done()
        });
    });
    it('should cache the devlog', (done) => {
      redisClient.get(`DB:DEV_LOG:${devLog.id}`, (err, val) => {
        expect(val).to.be.string
        done()
      });
    });
  });

});