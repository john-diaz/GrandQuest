const helpers = require('../helpers');
const redisClient = require('../redisClient');
const pool = require('../db/client');
const s3Client = require('../s3-client');

module.exports = app => {
  app.get('/devlog/:id?', (req, res) => {
    const id = isNaN(Number(req.params.id)) ? false : req.params.id
    
    if (id) {
      // add devlog content!

      helpers.getTemplate({ title: 'DevLog' }, ({ status, html }) => {
        res.status(status).send(html);
      });
    } else {
      helpers.getTemplate({ title: 'Devlog' }, ({ status, html }) => {
        res.status(status).send(html);
      });
    }
  });

  // API ROUTES

  app.get('/api/devlog/:id?', (req, res) => {
    const id = isNaN(Number(req.params.id)) ? false : req.params.id

    if (id) {
      redisClient.get(`DEVLOG#${id}`, (err, val) => {
        if (val && !err) {
          let data = JSON.parse(val);
          return res.status(200).json({ data });
        }
    
        pool.query(`SELECT * FROM dev_log WHERE ID = ${id}`, (err, results) => {
          if (err || !results.rowCount)
            return res.status(404).send('404! could not find that devlog...');
          
          var devLog = results.rows[0];
    
          s3Client.getObject({
            Bucket: 'grandquest-devlog',
            Key: devLog.log_url,
          }, (err, object) => {
            if (err)
              return res.sendStatus(500);
    
            let title = devLog.title;
            let html = object.Body.toString('utf-8');
    
            let data = { title, html };
    
            res.json({ data });
    
            redisClient.set(`DB:DEV_LOG:${req.params.id}`, JSON.stringify(data), 'EX', 60 * 60 * 3);
          });
        });
      });
    } else {
      redisClient.get('DB:DEV_LOG', (err, val) => {
        if (val && !err) {
          let data = JSON.parse(val);
          return res.json({ data });
        }
    
        pool.query('SELECT * FROM dev_log', (err , results) => {
          if (err || !results.rowCount)
            return res.status(404).json({ message: 'No dev logs found!' });
    
          var devLogs = results.rows
    
          res.json({ data: devLogs });
    
          redisClient.set('DB:DEV_LOG', JSON.stringify(devLogs), 'EX', 60 * 60)
        });
      })
    }
  });

  app.get('/api/devlog/:id', (req, res) => {
    
  });
}