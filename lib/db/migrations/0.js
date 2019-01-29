const { DB_NAME } = process.env;

if (!DB_NAME || DB_NAME === '') throw new Error('Invalid DB_NAME in .env');

const migration = `
CREATE DATABASE ${DB_NAME};
CREATE EXTENSION citext;
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  username CITEXT UNIQUE NOT NULL,
  gender TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  token CITEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE players (
  id integer NOT NULL REFERENCES users(id),
  gold INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  defense INTEGER NOT NULL DEFAULT 5,
  role TEXT NOT NULL DEFAULT 'Adventurer'
);
CREATE TABLE forums (
  title CITEXT UNIQUE NOT NULL
);
CREATE TABLE boards (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  forum_title CITEXT NOT NULL REFERENCES forums(title),
  admin_managed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  board_id INTEGER NOT NULL REFERENCES boards(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
`

module.exports = migration
