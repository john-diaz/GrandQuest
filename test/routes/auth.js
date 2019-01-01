process.env.NODE_ENV = 'test';

/* set up chai */
const chai = require('chai');
const chaihttp = require('chai-http');
chai.should();
const expect = chai.expect;
chai.use(chaihttp);

const server = require('../../index');

const pool = require('../tools/db');
const bcrypt = require('bcrypt');
const redisClient = require('../../lib/redisClient');

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
      describe('When using correct credentials', () => {
        it('should return an access token and user obj', done => {
          chai.request(server)
            .post('/auth')
            .send({
              email,
              password,
            })
            .end((err, res) => {
              expect(res.status).to.equal(200);
              expect(res).to.have.header('authorization');
              const user = res.body.payload;
              expect(user).to.be.an('object');
              expect(user).not.to.haveOwnProperty('hashed_password');
              expect(user).not.to.haveOwnProperty('token');

              done();
            });
        });
      });
    });
    describe('GET /auth', () => {
      describe('When bad credentials', () => {
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

              expect(user).to.haveOwnProperty('created_at');
              expect(user).to.haveOwnProperty('email');
              expect(user).to.haveOwnProperty('gender');
              expect(user).to.haveOwnProperty('is_admin');
              expect(user).to.haveOwnProperty('username');
              expect(user).not.to.haveOwnProperty('hashed_password');
              expect(user).not.to.haveOwnProperty('token');
              done();
            });
        });
      });
    });
    describe('DELETE /auth/:token ', () => {
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
      describe('when valid token', () => {
        it('should eliminate token from db', done => {
          chai.request(server)
          .del(`/auth/${accessToken}`)
          .end((err, res) => {
            expect(res.status).to.equal(200);
            pool.query('SELECT * FROM users WHERE email = $1', [email], (err, results) => {
              expect(results.rows[0].token).to.be.null;
              done();
            });
          });
        });
      });
      describe('when invalid token', () => {
        it('should send back status code 404', done => {
          chai.request(server)
          .del('/auth/123')
          .end((err, res) => {
            expect(res.status).to.equal(404);
            done();
          });
        });
      });
    });
  });
});