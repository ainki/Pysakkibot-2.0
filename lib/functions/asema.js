
const bot = require('../../bot');
var muuttujia = require('../flow/muutujia');

const {request} = require('graphql-request');
var jp = require('jsonpath');

var digiAPI = muuttujia.digiAPI;

function asema(asema) {

    let asemaData;
    const queryGetStopTimesForStops = `{
    stations(name: "${asema}") {
      gtfsId
      name
      lat
      lon
      stops {
        gtfsId
        name
        code
        platformCode
      }
    }
  }`;
    return request(digiAPI, queryGetStopTimesForStops)
            .then(function (data) {
                //returnataan haetut asemat
                return data.stations;
            })

            //Jos errori koko höskässä konsoliin errorviesti.
            .catch(err => {
                console.error("Ongelma valinnassa");
                console.error(err);
                return bot.sendMessage(chatId, `Ongelma valinnassa 😕. Kokeile uudestaan!`, {ask: 'askhaevalinta'});
            });

}
module.exports = asema;
