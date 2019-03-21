/* ./packages/services/discord.js */

const pool = require('./psql/pool');

const Discord = require('discord.js');
const client = new Discord.Client();

const { DISCORD_TOKEN, NODE_ENV } = process.env;

if (NODE_ENV === 'production') {
  if (!DISCORD_TOKEN) {
    throw new Error('Missing DISCORD_TOKEN env variable');
  }

  client.on('ready', () => {
    console.log(`DISCORD: Logged in as ${client.user.tag}`);
  });
  
  client.on('userUpdate', (user) => {
    console.log(user);
  });
  client.on('message', msg => {
    const content = msg.content.toLowerCase();
    if (content === '!ping') {
      msg.reply('Pong!');
    }
    if (content.substring(0, 7) === '!fetch ') {
      const username = content.substring(7, content.length).trim();
  
      if (!username.length) {
        return msg.reply('Please provide a proper username to fetch. Example: `!fetch skepdimi`');
      }
  
      msg.reply(`Fetching user "${username}"...`);
      pool.query(`SELECT * FROM users WHERE username = $1`, [username], (err, results) => {
        if (err) {
          return msg.reply('Something went wrong while fetch this user. Please try again later');
        }
  
        const user = results.rows[0];
  
        if (!user) {
          return msg.reply('A user by this username could not be found!');
        } else {
          return msg.reply(`
            User: ${user.username}
            Joined: ${user.created_at}
            Level: ${user.level}
            Gold: ${user.gold}
            XP: ${user.xp} / ${user.next_level_xp}
          `);
        }
      });
    }
  });
  
  client.login(DISCORD_TOKEN); 
}