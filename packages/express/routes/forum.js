const express = require('express');
const router = new express.Router();

const authMiddleware = require('../middleware/authentication');
const pool = require('../../services/psql/pool');
const async = require('async');

router.get('/forum/:title?', (req, res) => {
  const title = typeof req.params.title == 'string' ? req.params.title.trim().toLowerCase() : false;

  if (title) {
    pool.query('SELECT * FROM forum WHERE LOWER(title) = $1', [title], (err, results) => {
      if (err || !results.rowCount) {
        return res.status(404).json({message: 'Could not find forum'});
      }

      let forum = results.rows[0];

      // query for the boards associated to the forum
      pool.query('SELECT * FROM board WHERE id = ANY($1)', [forum.boards], (err, results) => {
        if (err) {
          return res.status(500).json({message: 'Failed to find board where id...'});
        }

        forum.boards = [...results.rows];

        res.json({message: 'Loaded forums', data: forum});
      });
    });
  } else {
    pool.query('SELECT * FROM forum', (err, results) => {
      if (err || !results.rowCount) {
        return res.status(404).json({message: 'Could not find any forums'});
      }

      let forums = results.rows;
      res.json({ message: 'Loaded forums', data: forums });
    });
  }
});

router.get('/boards/:id', (req, res) => {
  async.waterfall([
    callback => {
      pool.query('SELECT * FROM boards WHERE id = $1', [req.params.id], (err, results) => {
        if (err || !results.rowCount) {
          callback({status: 404, error: 'Could not find board with this id'});
        } else {
          callback(err, results.rows[0]);
        }
      });
    },
    (board, callback) => {
      pool.query('SELECT * FROM posts WHERE board_id = $1', [board.id], (err, results) => {
        board.posts = (!err && results.rowCount) ?
          results.rows
          : []
        callback(null, board);
      });
    },
    (board, callback) => {
      // for each board.posts
      // fill in the user object

      async.each(board.posts, (post, next) => {
        pool.query('SELECT * FROM users WHERE id = $1', [post.user_id], (err, results) => {
          delete post.user_id;

          post.user = (!err && results.rowCount > 0)
            ? results.rows[0]
            : null;

          next(null);
        });
      }, () => callback(null, board));
    },
  ], (err, board) => {
    if (err) {
      res.status(err.status).json({errors: [err.error]})
    } else {
      res.status(200).json({payload: board});
    }
  });
});
// TODO: Add unit testing for posts
router.get('/posts/:id', (req, res) => {
  const {id} = req.params;

  async.waterfall([
    // find the post
    (callback) => pool.query('SELECT * FROM posts WHERE id = $1', [id], (err, results) => {
      if (err || !results.rowCount) {
        callback({status: 404, error: 'Could not find any posts by this id'});
      } else {
        callback(null, results.rows[0]);
      }
    }),
    // set the user for this post
    (post, callback) => pool.query('SELECT * FROM boards WHERE id = $1', [post.board_id], (err, results) => {
      delete post.board_id;

      post.board = (!err && results.rowCount > 0)
        ? results.rows[0]
        : null;

      callback(null, post)
    }),
    // get the user
    (post, callback) => pool.query('SELECT * FROM users WHERE id = $1', [post.user_id], (err, results) => {
      delete post.user_id;

      post.user = (!err && results.rowCount > 0)
        ? results.rows[0]
        : null;
      callback(null, post);
    }),
  ], (err, post) => {
    if (err) {
      res.status(err.status).json({errors: [err.error]});
    } else {
      res.status(200).json({payload: post});
    }
  });
});

// TODO: create testing units for post creations
// TODO: sanitize post fields
router.post('/posts/:board_id', authMiddleware({ required: true }), (req, res) => {
  const user = req.user;

  const title = typeof req.body.title === 'string' && req.body.title.trim().length > 10 ? req.body.title.trim() : false;
  const body = typeof req.body.body === 'string' && req.body.body.trim().length > 25 ? req.body.body.trim() : false;

  let errors = [];

  if (!title) {
    errors.push('Title must be at least 10 characters long');
  }
  if (!body) {
    errors.push('Body must be at least 20 characters long');
  }

  if (errors.length) {
    return res.status(422).json({ errors });
  }

  async.waterfall([
    (callback) => pool.query('SELECT * FROM boards WHERE id = $1', [ req.params.board_id ], (err, results) => {
      if (err || !results.rowCount) {
        callback({ error: 'Could not find board to post to'});
      } else {
        callback(null, results.rows[0]);
      }
    }),
    (board, callback) => pool.query('INSERT INTO posts (title, body, board_id, user_id) values ($1, $2, $3, $4) RETURNING *', [title, body, board.id, user.id], (err, results) => {
      if (err || !results.rowCount) {
        return callback({ status: 500, error: 'Could not save post' });
      }
      
      if (board.admin_managed && !user.is_admin) {
        callback({ status: 401, error: 'You must be an admin to post to this board' });
      } else {
        callback(null, results.rows[0]);
      }
    }),
  ], (err, post) => {
    if (err) {
      res.status(err.status).json({ errors: [err.error] });
    } else {
      res.status(200).json({ payload: post });
    }
  });
});

module.exports = router
