// reitti.js

const bot = require('../../bot');
const {request} = require('graphql-request');
var jp = require('jsonpath');
var muuttujia = require('../flow/muutujia');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var moment = require('moment');
moment.locale('fi-FI');
"use strict";

// Näppäimistö
let replyMarkup = bot.keyboard([[bot.button('/hae'), bot.button('/reitti'), bot.button('location', 'Sijaintisi mukaan 📍')]], {resize: true});

var digiAPI = muuttujia.digiAPI;

let eiLoydy = true;

function reitti(msg, lat, lon, toiminto) {
    let lahtopaikkaviesti;
    if (toiminto === "L") {
        lahtopaikkaviesti = Object.assign({...msg}, {text: [lat, lon], tyyppi: "sijainti"});
        return lahtopaikkahaku(lahtopaikkaviesti);
    } else if (toiminto === "M") {
        maaranpaaviesti = Object.assign({...msg}, {text: [lat, lon], tyyppi: "sijainti"});
        return maaranpaahaku(maaranpaaviesti);
    }


    if (msg.text.trim() === '/reitti') {
        console.info(' Kysytään lähtöpaikkaa.');
        return bot.sendMessage(msg.from.id, '<b>Reittihaku</b>\nAnna reitin lähtöpaikka!  😃', {replyMarkup: 'hide', ask: 'lahtopaikka', parseMode: 'html'});
    } else {
        const jaettu = msg.text.replace('/reitti', '').trim().split(",");
        //lahtöpaikaks ennen ,
        lahtopaikkaviesti = Object.assign({...msg}, {text: jaettu[0], tyyppi: jaettu.length > 1 ? "ykskomento" : "kakskomentoo"});
        let maaranpaaviesti;
        console.info('Käsitellään reittiä...');

        lahtopaikkahaku(lahtopaikkaviesti);
        if (jaettu[1]) {
            //määränpääks , jälkeen
            maaranpaaviesti = Object.assign({...msg}, {text: jaettu[1], tyyppi: "ykskomento"});
            if (jaettu.length > 2) {
                maaranpaaviesti.lahtoaika = lahtoaikaHandler(jaettu[2]);
            }
            return maaranpaahaku(maaranpaaviesti);
        } else if (maaranpaaviesti) {
            //jos puuttuu
            maaranpaaviesti.text = "";
            return maaranpaahaku(maaranpaaviesti);
        }




    }
}



// Kysyy lähtöpaikan ja määränpään

// Arrayt

var lahtopaikat = [];
var maaranpaat = [];


bot.on('ask.lahtopaikka', msg => {
    for (var i = 0; i < maaranpaat.length; i++) {
        if (maaranpaat[i].userId === msg.from.id) {
            lahtopaikkahaku(msg, true);
        }

    }
    if (!msg.text.includes("/") && !msg.text.includes(",")) {
        // Hakee osoitteen koordinaatit
        // startingCords = JSON.parse(httpGet(`http://api.digitransit.fi/geocoding/v1/search?text=${msg.text}&size=1&lang=fi`));
        lahtopaikkahaku(msg);
    } else if (!msg.text.includes("/") && msg.text.includes(",")) {
        reitti(msg);
    } else {

    }

});

bot.on('ask.maaranpaa', msg => {
    if (msg.text.includes("/")) {
        tyhjennaArr(msg.from.id);



    } else if (msg.text.includes(",") && msg.text.includes(":")) {
        let splitattu = msg.text.trim().split(",");
        msg.lahtoaika = lahtoaikaHandler(splitattu[1]);
        msg.text = splitattu[0];
        maaranpaahaku(msg);

    } else {
        // Hakee osoitteen koordinaatit
        maaranpaahaku(msg);
    }
});

// Functions

function reitinKasittely(msg) {

    // Lähtöpaikka
    var userIdLahto = jp.query(lahtopaikat, '$..userId');
    var labelStart = jp.query(lahtopaikat, '$..label');
    var latStart = jp.query(lahtopaikat, '$..lat');
    var lonStart = jp.query(lahtopaikat, '$..lon');
    userIdLahto ? console.info('Käsitellään reittiä...') : console.error("lähtöpaikka puuttuu!");

    // Määränpää
    var userIdMaaranpaa = jp.query(maaranpaat, '$..userId');
    var labelDest = jp.query(maaranpaat, '$..label');
    var latDest = jp.query(maaranpaat, '$..lat');
    var lonDest = jp.query(maaranpaat, '$..lon');
    userIdLahto ? console.info('Käsitellään reittiä...') : console.error("määränpää puuttuu!");

    let plan;
    const date = moment(msg.lahtoaika).locale("eu").format('L');
    const time = moment(msg.lahtoaika).locale("et").format('LTS');

    for (let i = 0; i < userIdLahto.length; i++) {
        if (userIdLahto[i] === msg.from.id) {
            for (let x = 0; x < userIdMaaranpaa.length; x++) {
                if (userIdMaaranpaa[x] == msg.from.id) {
                    plan = msg.lahtoaika ? `plan(from: {lat: ${latStart[i]}, lon: ${lonStart[i]}}, to: {lat: ${latDest[x]}, lon: ${lonDest[x]}},date:"${date}",time:"${time}", numItineraries: 3) {` :
                            `plan(from: {lat: ${latStart[i]}, lon: ${lonStart[i]}}, to: {lat: ${latDest[x]}, lon: ${lonDest[x]}}, numItineraries: 3) {`;
                    const query = `{
                ${plan}
                itineraries {
                  startTime
                  endTime
                  duration
                  walkDistance
                  fares {
                    components {
                      fareId
                    }
                  }
                  legs {
                    startTime
                    endTime
                    mode
                    realTime
                    distance
                    route {
                      shortName
                    }
                    trip {
                      tripHeadsign
                    }
                    to {
                      name
                      stop {
                        code
                        platformCode
                      }
                    }
                  }
                }
              }
            }`;

                    return request(digiAPI, query)
                            .then(data => {
                                lahtopaikat.splice(i, 1);
                                maaranpaat.splice(x, 1);
                                return reittienListaus(msg, labelStart[i], labelDest[x], data);
                            }).catch(err => {
                        console.error("Ongelma valinnassa");
                        console.error(err);
                        return bot.sendMessage(msg.from.id, `Ongelma valinnassa. Kokeile uudestaan!`, {ask: 'askhaevalinta'});
                    });
                }
            }
        }
    }
}

function reittienListaus(msg, lahtopaikka, maaranpaa, data) {

    // Tekee viestin yläosan
    var legs = jp.query(data, '$..legs');
    if (!legs.length) {
        // jos ei reittiehdotuksia
        tyhjennaArr(msg.from.id);
        eiLoydy = true;
        return bot.sendMessage(msg.from.id, "Reittiehdotuksia ei valitettavasti löytynyt lähtöpaikan " + lahtopaikka + " ja määränpään " + maaranpaa + " välille", {replyMarkup, parseMode: 'html'});
    }
    const ylaosa = msg.lahtoaika ? '<b>Reittiehdotukset\n' + moment(msg.lahtoaika).format("DoMM.YYYY, H:mm") + '</b>\n' + lahtopaikka + '\n' + maaranpaa + '\n\n' : '<b>Reittiehdotukset</b>\n' + lahtopaikka + '\n' + maaranpaa + '\n\n';

    // var duration = jp.query(data, '$..duration');
    let ehdotukset = '';

    for (let i = 0; i < legs.length; i++) {

        var mode = jp.query(legs[i], '$..mode');
        var dist = jp.query(legs[i], '$..distance');

        // reittivaihtoehdon lähtöaika, saapumisaika ja kävelymatkat yhteensä
        const routeStartTime = data.plan.itineraries[i].startTime;
        const routeEndTime = data.plan.itineraries[i].endTime;
        var walkDistance = data.plan.itineraries[i].walkDistance;

        // Walk distancen roundaaminen
        if (walkDistance >= 1000) {
            walkDistance = Math.round(walkDistance / 100) / 10 + "km";
        } else {
            walkDistance = Math.round(walkDistance) + "m";
        }

        // Käytetään matka-ajan laskemiseen
        var mEndTime = moment(routeEndTime);

        let vLegs = '';

        for (let x = 0; x < mode.length; x++) {
            var legHeadsign;
            var legDestination;

            // Legin aloitusaika ja mode
            let legStartTime = data.plan.itineraries[i].legs[x].startTime;
            let legMode = data.plan.itineraries[i].legs[x].mode;
            let lait;

            // yritetään hakea laituri
            try {
                lait = data.plan.itineraries[i].legs[x].to.stop.platformCode;
            } catch (e) {
                //jos ei oo otetaan laiturii siit tullu errori kiinni
                console.error("todennäkösesti turha errori:", e);
                lait = null;
            }


            if (dist[x] >= 1000) {
                dist[x] = Math.round(dist[x] / 100) / 10 + "km";
            } else {
                dist[x] = Math.round(dist[x]) + "m";
            }
            // Jos mode on mode on walk tkee kävele tekstin jos ei niin ottaa linjan tunnuksen ja linjakilven
            if (legMode == 'WALK') {
                legHeadsign = 'Kävele' + " " + dist[x];
            } else {
                legHeadsign = data.plan.itineraries[i].legs[x].route.shortName + ' ' + data.plan.itineraries[i].legs[x].trip.tripHeadsign;
            }

            // Yhden legin määränpään filteröinti
            if (data.plan.itineraries[i].legs[x].to.name == 'Destination') {
                legDestination = 'Määränpää';
                //jos ei oo koodia, jätetää se pois jottei tuu nullii
            } else if (legMode == 'WALK' && data.plan.itineraries[i].legs[x].to.stop.code) {

                legDestination = data.plan.itineraries[i].legs[x].to.name + ' ' + data.plan.itineraries[i].legs[x].to.stop.code;
            } else {
                legDestination = data.plan.itineraries[i].legs[x].to.name;
            }

            // Rakentaa yhden legin
            lait ? vLegs += '  ' + moment(legStartTime).format('HH:mm') + '  ' + legHeadsign + ' → ' + legDestination + ' Lait. ' + lait + '\n' : vLegs += '  ' + moment(legStartTime).format('HH:mm') + '  ' + legHeadsign + ' → ' + legDestination + '\n';
            // Lisää yhden legin kaikkiin  legeihin

        }
        vLegs += '  ' + moment(routeEndTime).format('HH:mm') + '  ' + "Perillä\n";
        // Joka reittivaihtoehdon rakentamien
        ehdotukset = ehdotukset + '<b>' + moment(routeStartTime).format('HH:mm') + ' - ' + moment(routeEndTime).format('HH:mm') + ' – 🕑 ' + mEndTime.diff(routeStartTime, 'minutes') + 'min  🚶 ' + walkDistance + '</b>\n' + vLegs + '\n';
    }
    // Lähettää viestin
    tyhjennaArr(msg.from.id);
    eiLoydy = true;
    return bot.sendMessage(msg.from.id, ylaosa + ehdotukset, {replyMarkup, parseMode: 'html'});
}


// XMLHttpRequests

function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false); // false for synchronous request
    xmlHttp.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    xmlHttp.send(null);
    return xmlHttp.responseText;
}

function lahtopaikkahaku(msg, maaranpaasta) {
    if (msg.tyyppi !== "sijainti") {
        const features = tekstiPOIHandler(msg.text, "L");
        if (features) {
            var [lon, lat] = features.geometry.coordinates;
            var label = features.properties.label;

            // [Debug] lähettää osotteen takasin
            // return bot.sendLocation(msg.from.id, [parseFloat(lat), parseFloat(lon)]);

            // Tallennetaan tiedot
            lahtopaikat.push({userId: msg.from.id, label: label, lon: lon, lat: lat});
            eiLoydy = false;
        } else if (msg.tyyppi === "kakskomentoo") {
            return bot.sendMessage(msg.from.id, 'Lähtöpaikkaa ei löytynyt .\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'lahtopaikka'});

        }
    } else {
        const sijainninLabel = sijaintiPOIHandler(msg.text[0], msg.text[1]);
        lahtopaikat.push({userId: msg.from.id, label: sijainninLabel, lat: msg.text[0], lon: msg.text[1]});
        eiLoydy = false;
    }

    setTimeout(() => {
        if (maaranpaat.length === 0) {
            if (maaranpaasta) {
                reitinKasittely(msg);
            }
            return maaranpaaKysymys(msg);
        } else {
            for (var i = 0; i < maaranpaat.length; i++) {
                if (maaranpaat[i].userId !== msg.from.id || (maaranpaat[i].userId === msg.from.id && maaranpaat[i].loyty && !maaranpaat[i].lat)) {
                    return maaranpaaKysymys(msg);
                } else if (maaranpaat[i].userId === msg.from.id && maaranpaasta) {
                    reitinKasittely(msg);
                }
            }
        }
    }, 10);



}



function maaranpaahaku(msg) {
    if (msg.tyyppi !== "sijainti") {
        const features = tekstiPOIHandler(msg.text, "M");


        if (features) {
            if (eiLoydy) {
                return bot.sendMessage(msg.from.id, 'Lähtöpaikkaa ei löytynyt 2.\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'lahtopaikka'});
            }
            var [lon, lat] = features.geometry.coordinates;
            var label = features.properties.label;

            // [Debug] lähettää osotteen takasin
            // return bot.sendLocation(msg.from.id, [parseFloat(lat), parseFloat(lon)]);

            // Tallennetaan tiedot
            maaranpaat.push({userId: msg.from.id, label: label, lon: lon, lat: lat, loyty: true});

            console.info('Käsitellään määränpäätä...');
            bot.sendAction(msg.from.id, 'typing');

            return reitinKasittely(msg);

        } else if (msg.text && !eiLoydy) {

            maaranpaat.push({userId: msg.from.id, loyty: false});
            return bot.sendMessage(msg.from.id, 'Määränpäätä ei löytynyt.\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'maaranpaa'});
        } else if (msg.text && eiLoydy) {
            return bot.sendMessage(msg.from.id, 'Lähtöpaikkaa eikä määränpäätä löytynyt.\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'lahtopaikka'});

        }
    } else {
        const sijainninLabel = sijaintiPOIHandler(msg.text[0], msg.text[1]);
        maaranpaat.push({userId: msg.from.id, label: sijainninLabel, lon: msg.text[1], lat: msg.text[0]});
        console.info('Käsitellään reittiä... sijaintimaaranpaa');
        bot.sendAction(msg.from.id, 'typing');
        console.info(' Kysytään lähtöpaikkaa.');
        return bot.sendMessage(msg.from.id, '<b>Reittihaku</b>\nAnna vielä reitin lähtöpaikka!  😃', {replyMarkup: 'hide', ask: 'lahtopaikka', parseMode: 'html'});
    }

}

function tyhjennaArr(chatId) {
    console.info('Postettu reitin arraysta');
    // Jos tekee komennon poistaa listoista
    var userIdLahto = jp.query(lahtopaikat, '$..userId');
    var userIdMaaranpaa = jp.query(maaranpaat, '$..userId');

    for (let i = 0; i < userIdLahto.length; i++) {
        if (userIdLahto[i] === chatId) {
            lahtopaikat.splice(i, 1);
        }
    }
    for (let x = 0; x < userIdMaaranpaa.length; x++) {
        if (userIdMaaranpaa[x] === chatId) {
            maaranpaat.splice(x, 1);
        }
    }
}
function lahtoaikaHandler(lahtoaika) {
    lahtoaika = lahtoaika.trim().split(" ");
    const lahtoKellonaika = lahtoaika[0].split(":");
    let lahtoPvm = "";
    if (lahtoaika.length > 1) {
        lahtoPvm = lahtoaika[1].split(".");
    }
    const tanaan = new Date();
    if (lahtoKellonaika.length === 2 && lahtoPvm.length === 0) {
        return new Date(tanaan.getFullYear(), tanaan.getMonth(), tanaan.getDate(), lahtoKellonaika[0], lahtoKellonaika[1], 0);
    } else if (lahtoKellonaika.length === 2 && lahtoPvm.length === 2) {
        return new Date(tanaan.getFullYear(), lahtoPvm[1] - 1, lahtoPvm[0], lahtoKellonaika[0], lahtoKellonaika[1], 0);
    } else if (lahtoKellonaika.length === 2 && lahtoPvm.length === 3) {
        return new Date(lahtoPvm[2], lahtoPvm[1] - 1, lahtoPvm[0], lahtoKellonaika[0], lahtoKellonaika[1], 0);

    }


}
function maaranpaaKysymys(msg) {
    console.info(' Kysytään määränpäätä.');
    bot.sendMessage(msg.from.id, 'Anna vielä määränpää!  😉', {replyMarkup: 'hide', ask: 'maaranpaa'});


}
function sijaintiPOIHandler(lat, lon) {
    try {
        const  osoiteHaku = JSON.parse(httpGet(encodeURI(`http://api.digitransit.fi/geocoding/v1/reverse?point.lat=${lat}&point.lon=${lon}&size=1`)));
        return osoiteHaku.features[0].properties.label;
    } catch (e) {
        console.error(e);
        return "[sijainti]";
    }
}
function tekstiPOIHandler(text, tyyppi) {
    try {
        const  startingCords = JSON.parse(httpGet(encodeURI(`http://api.digitransit.fi/geocoding/v1/search?text=${text}&size=1&lang=fi&boundary.rect.min_lat=59.9&boundary.rect.max_lat=60.45&boundary.rect.min_lon=24.3&boundary.rect.max_lon=25.5`)));
        return startingCords.features[0];
    } catch (e) {
        console.error(e);
        if (tyyppi === "M") {
            return bot.sendMessage(msg.from.id, 'Määränpään haussa tapahtui virhe.\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'maaranpaa'});
        } else {
            return bot.sendMessage(msg.from.id, 'Lähtöpaikan haussa tapahtui virhe.\nKokeile uudestaan!', {replyMarkup: 'hide', ask: 'lahtopaikka'});

        }
    }
}

//Exporttaa tän indexiins
module.exports = reitti;
