process.env.NODE_ENV = 'test';

/* set up chai */
const chai = require('chai');
const chaihttp = require('chai-http');
chai.should();
const expect = chai.expect;
chai.use(chaihttp);

const server = require('../index');

const pool = require('./tools/db');
const bcrypt = require('bcrypt');
const redisClient = require('../lib/redisClient');

const { BCRYPT_SALT, } = process.env;

describe('Authentication', () => {
  const email = 'me@user.com';
  const password = '!myPassword1234';

  describe('Auth flow', () => {
    // add user to test
    before(async () => {
      await pool.query('DELETE FROM users');

      const hashed = bcrypt.hashSync(password, Number(BCRYPT_SALT));
      await pool.query('INSERT INTO users (email, gender, username, hashed_password) values ($1, $2, $3, $4)', [email, 'male', 'skepdimi', hashed]);
    });

    describe('POST /auth', () => {
      describe('When using incorrect credentials', () => {
        it('should not return access token', done => {
          chai.request(server)
            .post('/auth')
            .send({
              email,
              password: 'nope lol!',
            })
            .end((err, res) => {
              expect(res.status).to.equal(401);
              expect(res).not.to.have.header('authorization');
              done();
            });
        });
      });
      describe('When using correct credentials', () => {
        it('should not have accessToken in redis', done => {
          redisClient.get(`accessToken/${email}`, (err, jwt) => {
            expect(jwt).to.be.null;
            done();
          });
        });
        it('should return an access token', done => {
          chai.request(server)
            .post('/auth')
            .send({
              email,
              password,
            })
            .end((err, res) => {
              expect(res.status).to.equal(201);
              expect(res).to.have.header('authorization');
              done();
            });
        });
        it('should have accessToken in redis', done => {
          redisClient.get(`accessToken/${email}`, (err, jwt) => {
            expect(jwt).to.be.a('string');
            done();
          });
        });
        it('should not create new accessToken on further request', done => {
          chai.request(server)
            .post('/auth')
            .send({
              email,
              password,
            })
            .end((err, res) => {
              expect(res.status).to.equal(200);
              done();
            });
        });
      });
    });
    describe('GET /auth', () => {
      describe('When invalid credentials', () => {
        describe('When no credentials are provided', () => {
          it('should give us a 422 status code', done => {
            chai.request(server)
              .get('/auth')
              .end((err, res) => {
                expect(res.status).to.equal(422);
                done();
              });
          });
        });
        describe('When invalid credentials are provided', () => {
          it('should give us a 401 status code', done => {
            chai.request(server)
              .get('/auth')
              .set('Authorization', 'fake token here')
              .end((err, res) => {
                expect(res.status).to.equal(401);
                done()
              });
          });
        });
      });
      describe('When correct credentials', () => {
        let accessToken;

        before(done => {
          chai.request(server)
            .post('/auth')
            .send({ email, password })
            .end((err, res) => {
              accessToken = res.headers['authorization'];

              done();
            });
        });
        it('should give us our user object', done => {
          chai.request(server)
            .get('/auth')
            .set('authorization', accessToken)
            .end((err, res) => {
              expect(res.status).to.equal(200);
              const user = res.body.payload;

              expect(user).to.deep.equal({ email, username: 'skepdimi', gender: 'male' });
              done();
            });
        });
      });
    });
  });
});