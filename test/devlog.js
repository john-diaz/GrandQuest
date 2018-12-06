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
    it('should not be cached', (done) => {
      redisClient.get('DEVLOG', (err, val) => {
        expect(val).to.be.null
        done()
      });
    });
    it('should receive an HTML file', (done) => {
      chai.request(server)
        .get('/devlog')
        .end((err, res) => {
          res.should.have.status(200);
          res.type.should.be.eql('text/html');

          done();
        });
    });
    it('should cache the HTML file', (done) => {
      redisClient.get('DEVLOG', (err, val) => {
        expect(val).to.be.string

        done()
      });
    });
  });

  describe('GET /api/devlog/:id', () => {
    var devLog;
    var expectedHTML;

    before((done) => {
      pool.query('SELECT * FROM dev_log WHERE ID = 1', async (err, results) => {
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
      redisClient.get(`DEVLOG#${devLog.id}`, (err, val) => {
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
      redisClient.get(`DEVLOG#${devLog.id}`, (err, val) => {
        expect(val).to.be.string
        done()
      });
    });
  });

});