const express = require('express');
const router = new express.Router();
const redisClient = require('../redisClient');
const pool = require('../db/client');
const s3Client = require('../s3-client');


router.get('/devlog/:id?', (req, res) => {
  const id = isNaN(Number(req.params.id)) ? false : req.params.id

  if (id) {
    // redisClient.get(`DB:DEV_LOG:${id}`, (err, val) => {
    //   if (val && !err) {
    //     let data = JSON.parse(val);

    //     res.set('Cache-Control', 'public');
    //     return res.status(200).json({ data });
    //   }

      pool.query(`SELECT * FROM dev_log WHERE ID = ${id}`, (err, results) => {
        if (err || !results.rowCount)
          return res.status(404).send('404! could not find that devlog...');

        var devLog = results.rows[0];

        s3Client.getObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: devLog.log_url,
        }, (err, object) => {
          if (err)
            return res.sendStatus(500);

          let html = object.Body.toString('utf-8');

          let data = { ...devLog, html };

          // res.set('Cache-Control', 'public');
          res.json({ data });

          // redisClient.set(`DB:DEV_LOG:${req.params.id}`, JSON.stringify(data), 'EX', 60 * 60 * 3);
        });
      });
    // });
  } else {
    // redisClient.get('DB:DEV_LOG', (err, val) => {
    //   if (val && !err) {
    //     let data = JSON.parse(val);
    //     return res.json({ data });
    //   }

      pool.query('SELECT * FROM dev_log', (err , results) => {
        if (err || !results.rowCount)
          return res.status(404).json({ message: 'No dev logs found!' });

        var devLogs = results.rows

        res.json({ data: devLogs });

        // redisClient.set('DB:DEV_LOG', JSON.stringify(devLogs), 'EX', 60 * 60)
      });
    // });
  }
});

module.exports = router
