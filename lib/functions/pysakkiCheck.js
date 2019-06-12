// pysakkiCheck.js
const bot = require('../../bot')
var muuttujia = require('../flow/muutujia');
var lahtoListaus = require('./lahtoListaus');
const { request } = require('graphql-request');
// muuttujia
var digiAPI = muuttujia.digiAPI;

// var kayttajat = []


function pysakkiCheck(chatId, text, viimekomento) {

console.log(viimekomento);
  if (text) {
        if (text.includes('/') && numMaara(text) === 4  && !text.trim().includes(" ")) {
        text = text.replace('/', '')
            // for (i = 0; i < kayttajat.length; i += 1) {
            //     if (kayttajat[i] == chatId) {
            //         return;
            //     }
            //
            // }
            text = capitalize(text);
            console.log("[info] Haetaan aikatauluja...")
            // Lähetetään actioni
            bot.sendAction(chatId, 'typing')
            // kayttajat.push(chatId)
            // Funktion kutsuminen
            return valintafunktio(chatId, text, viimekomento);
        } else {
            // return kayttajat.push(chatId)
        }
    }
    text.includes("/hae") ? viimeViestihaku = true : viimeViestihaku = false;
    }


module.exports = pysakkiCheck;

function valintafunktio(chatId, valinta,viimekomento) {
console.log(chatId,valinta);
    const queryGetStopTimesForStops = `{
    stops(name: "${valinta}") {
      platformCode
      name
      code
      stoptimesWithoutPatterns (numberOfDepartures: 10) {
        realtimeDeparture
        realtimeState
        pickupType
        dropoffType
        headsign
        trip {
          pattern {
            route {
              shortName
              alerts {
                alertDescriptionText
              }
            }
          }
        }
      }
    }
  }`


    //Hakulauseen suoritus
    return request(digiAPI, queryGetStopTimesForStops)
        .then(function (data) {
            // lahtoListuas hoitaa lähtöjen listauksen
            var lahdotPysakeilta = lahtoListaus(data);

                let replyMarkup = bot.keyboard(nappaimisto, { resize: true })
              if (viimekomento !== "/hae") {
                var valintaArr = []
                valintaArr.push('/' + valinta)
                var nappaimisto = chunkArray(valintaArr, 1);
                let replyMarkup = bot.keyboard(nappaimisto, { resize: true });
                console.log('[info] Lähdöt lähetetty')
                return bot.sendMessage(chatId, lahdotPysakeilta, { replyMarkup, ask: 'ask/valinta' });
            } else {
                //Viestin lähetys
                console.log('[info] Lähdöt lähetetty')
                return bot.sendMessage(chatId, lahdotPysakeilta, { ask: 'ask/valinta' });
            }
        })
}

function numMaara(viesti) {
    //tarkistetaan numeroiden määrä
    return viesti.replace(/[^0-9]/g, "").length;
}

const capitalize = (s) => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function chunkArray(myArray, chunk_size) {
    var results = [];

    while (myArray.length) {
        results.push(myArray.splice(0, chunk_size));
    }
    results.push([bot.button('/hae'), bot.button('/linja'), bot.button('location', 'Sijaintisi mukaan 📍')])
    return results;
}
