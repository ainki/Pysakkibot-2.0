// hae.js

const bot = require('../../bot')
const { request } = require('graphql-request')
var jp = require('jsonpath');
var TimeFormat = require('hh-mm-ss')
var limit = require('limit-string-length');
var muuttujia = require('../flow/muutujia');
var admin = require('./admin');

//const digiAPI = 'http://api.digitransit.fi/routing/v1/routers/hsl/index/graphql';

var digiAPI = muuttujia.digiAPI;
var tyhjavastaus = muuttujia.tyhjavastaus;
var hetkinen = admin.hetkinen;


// Hae komento
function hae(chatId, viesti) {
    //Jos tkesti on pelkästään /hae, ohjelma kysyy pysäkin nimeä tai koodia erikseen
    if (viesti == '/hae') {
        console.log("[info] Kysytty pysäkkiä.")
        return bot.sendMessage(chatId, 'Anna pysäkin nimi tai koodi 😄', { replyMarkup: 'hide', ask: 'pysakkinimi' }).then(re => { })
    } else {
        //Muuten etsii suoraan. Heittää viestin hetkinen ja menee pysäkkihaku funktioon
        console.log("[info] Hetkinen...")
        console.log("funktion hae: "+hetkinen)
        return bot.sendMessage(chatId, `${hetkinen}`).then(re => {
            //Poistaa "/hae " tekstin
            viesti = viesti.replace('/hae ', '');
            //Kutuu funktion
            pysakkihaku(chatId, re.message_id, viesti);
        })
    }
}
//Exporttaa tän indexiin
module.exports = hae;

//Pysäkkinimi kysymys
bot.on('ask.pysakkinimi', msg => {
    let text = msg.text;

    //Komennot jotka ei tee pysökkihakua
    if (text == "/start" || text == undefined || text.includes("/hae") || text == "/help" || text == "/linja" || text == "/menu" || text.includes("/admin")) {
        //Keskeytetään kysymys
    } else {
        console.log("[info] Hetkinen...")
        //Lähetetään hetkinen
        return bot.sendMessage(msg.chat.id, `${hetkinen}`).then(re => {
            //Funktioon siirtyminen
            pysakkihaku(msg.chat.id, re.message_id, text);
        })
    }
});

//Funktio pysäkkihaku
function pysakkihaku(chatId, messageId, viesti) {
    //graphQL hakulause
    const query = `{
	    stops(name: "${viesti}") {
        gtfsId
        name
        code
        }
        }`

    //Hakulauseen suoritus
    return request(digiAPI, query)
        .then(function (data) {
            //Data on vastaus GraphQL kyselystä
            //Muutuja vastaus stringifaijattu data
            var vastaus = JSON.stringify(data);
            //Jos pysäkin nimellä ei löydy pysäkkiä
            if (vastaus == tyhjavastaus) {
                //Lähettää tyhjän viestin joka tekee kysymyksen
                bot.sendMessage(chatId, ``, { ask: 'pysakkinimi' }).catch(error => console.log('[info] Pysäkkejä ei löytynyt!'));
                //Editoi viestin
                bot.editMessageText({ chatId, messageId }, `Pysäkkiä "${viesti}" ei valitettavasti löydy.\nKokeile uudestaan 😄`, { ask: 'pysakkinimi' });
                return console.log("[info] Pysäkkiä ei löytynyt.")
            } else {
                //Hakee pyäkit ja koodit niille
                var pysakit = jp.query(data, '$..name')
                var koodit = jp.query(data, '$..code')
                //Erittelee pysäkit ja yhdistää koodit
                for (i = 0; i < pysakit.length; i += 1) {
                    koodi = koodit[i];
                    //Yhdistää muuttujaan valinnat
                    var pk = "/" + koodi + " " + pysakit[i] + " - " + koodit[i] + "\n"
                    //Tallentaa toiseen muuttujaan kaikki pk muuttujat
                    //Jos tehdään ensinmäinen valinta
                    if (pysakkivalinta == null) {
                        //Viesti
                        pysakkivalinta = pk;
                        //Luodaan tyhjä näppäimistö
                        var nappaimisto = []
                        nappaimisto.push("/" + koodi)
                    } else {
                        //Viesti
                        pysakkivalinta = pysakkivalinta += pk;
                        //Näppäimistö
                        nappaimisto.push("/" + koodi)
                    }
                }
                //Näppäimistö jaetaan kahteen riviin
                nappaimisto2 = nappaimisto.splice(0, Math.ceil(nappaimisto.length / 2));
                //Näppäimistön alaosa
                var nappaimistoAla1 = [bot.button('/hae'), bot.button('location', 'Sijaintisi mukaan 📍')]
                //Rakennetaan nappaimisto
                let replyMarkup = bot.keyboard([nappaimisto2, nappaimisto, nappaimistoAla1], { resize: true });

                //Returnaa pysäkit tekstinä ja tyhjentää pysäkkivalinnan
                console.log("[info] Valinnat lähetetty!")
                bot.editMessageText({ chatId, messageId }, `Etsit pysäkkiä "${viesti}".\nValitse alla olevista vaihtoehdoita oikea pysäkki!\n\n${pysakkivalinta}`)
                return bot.sendMessage(chatId, `Voit valita pysäkin myös näppäimistöstä! 😉`, { replyMarkup, ask: 'askpysakkivalinta' })//.catch(error => console.log('[info] Valinnat lähetetty!'));
                //return bot.sendMessage(chatId , `Etsit pysäkkiä "${viesti}".\nValitse alla olevista vaihtoehdoita oikea pysäkki!\n\n${pysakkivalinta}`, { ask: 'askpysakkivalinta' })
                var pysakkivalinta = undefined;
                var nappaimisto = undefined;
            }
        }
        )
        //Jos errori koko höskässä konsoliin errorviesti. Valitettavasti ihan mikä vaa error on GraphQL error mut ei voi mitää
        .catch(err => {
            console.log("[ERROR] GraphQL error")
            console.log(err)
            return bot.editMessageText({ chatId, messageId }, `Ongelma pyynnössä. Kokeile uudestaan!`)
        })
};

//Pysäkkivalinta kysymys
bot.on('ask.askpysakkivalinta', msg => {
    const valinta = msg.text;

    //Komennot jotka ei tee pysökkihakua
    if (valinta == "/start" || valinta == "/hide" || valinta == undefined || valinta.includes("/hae") || valinta == "/help" || valinta == "/linja" || valinta == "/menu" || valinta.includes("/admin")) {
        //Keskeytetään kysymys
    } else {
        //Jos sisältää "/" mennään suoraan valintafunktioon
        if (valinta.includes("/")) {

            console.log("[info] Haetaan aikatauluja...")
            return bot.sendMessage(msg.from.id, `${hetkinen}`).then(re => {

                valintafunktio(msg.from.id, re.message_id, valinta);
            })
        } else { //Jos ei siällä "/" niin kysytään uudelleen
            bot.sendMessage(msg.from.id, ``, { ask: 'askpysakkivalinta' }).catch(error => console.log('[info] Ei pysäkin koodia!'));
            //Do nothing
        }
    }
});

//Valinta - /HAE -> /xxxx (pysäkin tunnus)
function valintafunktio(chatId, messageId, valinta) {
    //Jos pelkästään kauttaviiva
    if (valinta == '/') {
        return bot.editMessageText({ chatId, messageId }, `"/" ei ole pysäkki. Kokeile uudestaan!`, { ask: 'askpysakkivalinta' });
    }
    //Poistaa "/" merkin ja tyhjän välin
    valintavastaus = valinta.replace('/', '');
    if (valintavastaus.includes(' ')) {
        valintavastaus = valintavastaus.replace(' ', '')
    }
    //Query
    const queryGetStopTimesForStops = `{
            stops(name: "${valintavastaus}") {
              name
              code
              stoptimesWithoutPatterns (numberOfDepartures: 10) {
                realtimeDeparture
                headsign
                realtime
                trip {
                  pattern {
                    route {
                      shortName
                    }
                  }
                }
              }
            }
          }`

    //Hakulauseen suoritus
    return request(digiAPI, queryGetStopTimesForStops)
        .then(function (data) {
            //Datan haku queryn vastauksesta
            var stopshaku = jp.query(data, '$..stops')
            var stoptimeshaku = jp.query(stopshaku, '$..stoptimesWithoutPatterns')
            var lahtohaku = jp.query(data, '$..realtimeDeparture')
            var realtimes = jp.query(stoptimeshaku, '$..realtime')

            //Eritellään vastaukset
            for (i = 0; i < lahtohaku.length; i += 1) {
                var stoptimesif = JSON.stringify(stoptimeshaku[i])
                var lahto = lahtohaku[i]
                var realtime = realtimes[i]
                //Jos ei lähtöä
                if (stoptimesif == "[]") {
                    //Do nothing
                } else {
                    //Hakee datasta nimen ja koodin
                    var pysakki = jp.query(stopshaku, '$..name')
                    var koodi = jp.query(stopshaku, '$..code')

                    //Hakee ajan ja muuttaa sen numeroksi
                    var lahtoaikaNUM = Number(lahto)
                    //Muuntaa ajan sekunneista minuutiksi
                    var departuretime = TimeFormat.fromS(lahtoaikaNUM, 'hh:mm');
                    //Limitoi sekunnit pois
                    var departuretimeshort = limit(departuretime, 5)
                    //Kellonaikojen korjaus
                    if (lahtoaikaNUM > 86400) {
                        var departuretimeshort = departuretimeshort.replace('24:', '00:')
                    } if (lahtoaikaNUM > 90000) {
                        var departuretimeshort = departuretimeshort.replace('25:', '01:')
                    } if (lahtoaikaNUM > 93600) {
                        var departuretimeshort = departuretimeshort.replace('26:', '02:')
                    } if (lahtoaikaNUM > 97200) {
                        var departuretimeshort = departur/etimeshort.replace('27:', '03:')
                    } if (lahtoaikaNUM > 100800) {
                        var departuretimeshort = departuretimeshort.replace('28:', '04:')
                    }
                    //Hakee linjan numeron tai kirjaimen
                    var linjatunnus = jp.query(data, '$..shortName')
                    //Hakee määränpään
                    var maaranpaa = jp.query(stopshaku, '$..headsign')
                    //Jos määränpää on tyhjä
                    if (maaranpaa[i] == null) {
                        //Älä tee mitään
                    } else {
                        //Tarkistaa onko reaaliaikainen vai aikataulun mukainen aika
                        if (realtime == true) {
                            //Yhdistää ajan, reaaliaikamerkin, numeron/kirjaimen ja määränpään
                            var yksittainenlahto = departuretimeshort + "•  " + linjatunnus[i] + " " + maaranpaa[i] + "\n";
                        } else {
                            //Yhdistää ajan, numeron/kirjaimen ja määränpäänn
                            var yksittainenlahto = departuretimeshort + "    " + linjatunnus[i] + " " + maaranpaa[i] + "\n";
                        }
                        //Yhdistää yksittäiset lähdöt viestiä varten
                        if (lahdot == null) {
                            lahdot = yksittainenlahto;
                        } else {
                            lahdot = lahdot + yksittainenlahto;
                        }
                    }
                }
            }
            //Viestin lähetys
            //Jos ei lähtöjä pysäkiltä
            if (lahdot == undefined) {
                bot.sendMessage(chatId, ``, { ask: 'askpysakkivalinta' }).catch(error => console.log('[info] Ei lähtöjä.'));
                return bot.editMessageText({ chatId, messageId }, `Ei lähtöjä pysäkiltä.`, { ask: 'askpysakkivalinta' });
                var lahdot = undefined;
            } else { //Muuten lähettää viestin ja kysyy pysäkkivalintaa
                bot.sendMessage(chatId, ``, { ask: 'askpysakkivalinta' }).catch(error => console.log('[info] Vastaus lähetetty!'));
                return bot.editMessageText({ chatId, messageId }, `Lähdöt pysäkiltä ${pysakki} - ${koodi}:\n\n${lahdot}`, { ask: 'askpysakkivalinta' });
                var lahdot = undefined;
            }
        })

        //Jos errori koko höskässä konsoliin errorviesti. Valitettavasti ihan mikä vaa error on GraphQL error mut ei voi mitää
        .catch(err => {
            console.log("[ERROR] GraphQL error")
            console.log(err)
            return bot.editMessageText({ chatId, messageId }, `Ongelma valinnassa. Kokeile uudestaan!`)
        })
}