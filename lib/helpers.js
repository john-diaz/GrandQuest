const path = require('path');
const fs = require('fs');
const redisClient = require('./redisClient');
const pool = require('./db/client');
const s3Client = require('./s3-client');

let helpers = {}

helpers.cache = {}
helpers.cache.flush = () => {
  redisClient.flushdb((err, res) => {
    if (err || !res) {
      console.log('$ REDIS: FAILED TO FLUSH CACHE => ', err);
    } else {
      console.log('$ REDIS: flushed cache');
    }
  });
}

helpers.getTemplate = (options, cb) => {
  let title = typeof options.title =='string' && options.title.trim().length > 0 ? options.title.trim() : false

  if (!title && !htmlFileName) return cb({ status: 404, html: 'not found' });

  let htmlFileName = typeof options.htmlFileName == 'string' && options.htmlFileName.trim().length > 5 ? options.htmlFileName.trim() : `${title.trim().toLowerCase()}.html`

  if (!htmlFileName) {
    return cb({ status: 404, html: 'not found' });
  }

  template = helpers.generateTemplate(title, htmlFileName);

  cb({ status: 200, html: template });
}
helpers.generateTemplate = (title, fileName) => {
  const fileDir = path.join(__dirname, '..', 'client', 'views', fileName);

  const html = fs.readFileSync(fileDir) || '404';

  const template = helpers.injectIntoHTML({ title, html });

  return template
}
helpers.injectIntoHTML = ({ title, html }) => {
  const htmlTitle = typeof title == 'string' && title.trim().length > 0 ? title.trim() : false
  
  return `
    <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet"> 
        
        ${ htmlTitle ? `<link rel="stylesheet" href="../dist/css/${htmlTitle.toLowerCase()}.css">` : '' }
        <link rel="stylesheet" href="../dist/css/styles.css">
        <title>${ htmlTitle ? `GrandQuest - ${htmlTitle}` : 'GrandQuest - RPG / Multiplayer' }</title>
      </head>
      <body>
        <div class="root">
          <div class="main-header">
            <div class="main-header__content">
              <a title="looking for a logo!" href="/" id="title">GRANDQUEST</a>
              <div class="main-header__navigation">
                <a href="forum">Forum</a>
                <a href="signup">Register</a>
                <a href="login">Log In</a>
              </div>
            </div>
            <div class="main-header__sub">
              <a href="about">about</a>
              <a href="contributing">contributing</a>
              <a href="devlog">Dev Log</a>
            </div>
          </div>
          ${ html }
        </div>
      </body>
      <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
      ${ htmlTitle ? `<script src="../dist/js/${htmlTitle.toLowerCase()}.js"></script>` : '' }
    </html>
  `
}

module.exports = helpers
