// nappaimisto.js

const bot = require('../../bot')


//Perusnäppäimitö
let replyMarkup = bot.keyboard([
    [bot.button('/hae'), bot.button('/pysakki'), bot.button('location', 'Sijaintisi mukaan 📍')],
    ['/linja','/help']
], { resize: true });

module.exports = replyMarkup
