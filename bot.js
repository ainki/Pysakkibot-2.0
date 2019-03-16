//
//  Pysäkkibot-2.0
//
// Do not commit this file with a token or without any changes!

//NPM
const TeleBot = require('telebot');

//BotToken
const bot = new TeleBot({
    token: 'TOKEN',
    usePlugins: ['askUser', 'floodProtection', 'namedButtons'],
    pluginConfig: {
        floodProtection: {
            interval: 0.5,
            message: 'Ota iisisti ja relaa 😤'
        }
    }
});

module.exports = bot;
