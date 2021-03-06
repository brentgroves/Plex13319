// https://github.com/vpulim/node-soap
const soap = require('soap');
const mqtt = require('mqtt');
const config = require('../Config13319/config.json');
const common = require('@bgroves/common');

var { MQTT_SERVER, PROD_WSDL, TEST_WSDL,ALBION_USER,ALBION_PASSWORD,AVILLA_USER,AVILLA_PASSWORD } = process.env;

/*  TESTING ONLY
var MQTT_SERVER = 'localhost';
var PROD_WSDL = './plex-prod.wsdl';
var TEST_WSDL = './plex-test.wsdl'
var ALBION_USER = 'BuscheAlbionWs2@plex.com'
var ALBION_PASSWORD = '6afff48-ba19-'
var AVILLA_USER = 'BuscheAvillaKorsws@plex.com'
var AVILLA_PASSWORD = '5b11b45-f59f-'
*/
var mqttClient;

// At the bottom of the wsdl file you will find the http address of the service

// CNC422
// WorkcenterGroup/WorkCenter
// GA FWD Knuckle/FWD BE 517
// Plex Workcenter: 61420

async function getSetupContainers(TransDate, PCN, ProdServer, Workcenter, CNC) {
  let plexWSDL;
  if (ProdServer) plexWSDL = PROD_WSDL;
  else plexWSDL = TEST_WSDL;

  var BAS;
  if ('Albion' == PCN) {
    BAS = new soap.BasicAuthSecurity(ALBION_USER, ALBION_PASSWORD);
  } else if ('Avilla' == PCN) {
    BAS = new soap.BasicAuthSecurity(AVILLA_USER, AVILLA_PASSWORD);
  }

  soap.createClient(plexWSDL, function(err, client) {
    // we now have a soapClient - we also need to make sure there's no `err` here.
    if (err) {
      common.log("caught exception!", err);
      return;
    }

    client.setSecurity(BAS);
    // debugger;
    var request_data = {
      ExecuteDataSourceRequest: {
        DataSourceKey: '13318',
        InputParameters: {
          InputParameter: {
            Name: 'Workcenter_Key',
            Value: `${Workcenter}`,
            Required: 'true',
            Output: 'false',
          },
        },
      },
    };
    client.ExecuteDataSource(request_data, function(err, result) {
      // we now have a soapClient - we also need to make sure there's no `err` here.
      if (err) {
        common.log("caught exception!", err);
        return;
      }

      var res = result.ExecuteDataSourceResult.ResultSets.ResultSet[0].Rows.Row;
      var setupContainer = {};
      for (let i = 0; i < res.length; i++) {
        let container = res[i].Columns.Column;
        for (let j = 0; j < container.length; j++) {
          let name = container[j].Name;
          setupContainer[name] = container[j].Value;
        }
        // debugger;
        setupContainer['TransDate'] = TransDate;
        setupContainer['Workcenter'] = Workcenter;
        setupContainer['CNC'] = CNC;
        setupContainer['ProdServer'] = ProdServer;
        setupContainer['PCN'] = PCN;
        // Ready javascript object for transport
        let msgString = JSON.stringify(setupContainer);

        common.log(msgString);

        mqttClient.publish('Plex13319', msgString);
        setupContainer = {};
      }
    });
  });
}

function main() {
  //Test
  var testDate = '2020-06-29 00:00'
//  var testDate = '2019-12-15 09:00'
  // getSetupContainers(testDate, 'Avilla', true, '61324','103');
  // getSetupContainers(testDate, 'Avilla', false, '61318','360');
  // getSetupContainers(testDate, 'Avilla', true, '61314','362');
  // getSetupContainers(testDate, 'Avilla', false, '61420','422');
/*
  for (let i = 0; i < config.nodes.length; i++) {
    if(config.nodes[i].workcenter_Key!='0'){
      let PCN = config.nodes[i].pcn;
      let WorkCenter_Key = config.nodes[i].workcenter_Key;
      getSetupContainers(testDate, config.nodes[i].pcn, true, config.nodes[i].workcenter_Key,config.nodes[i].cnc);
      getSetupContainers(testDate, config.nodes[i].pcn, false, config.nodes[i].workcenter_Key,config.nodes[i].cnc);
    }
  }
*/
  common.log(`Plex 13319->MQTT_SERVER=${MQTT_SERVER}`);
  mqttClient = mqtt.connect(`mqtt://${MQTT_SERVER}`);

  mqttClient.on('connect', function() {
    mqttClient.subscribe('Alarm13319-1', function(err) {
      if (!err) {
        common.log('Plex13319 has subscribed to Alarm13319-1');
      }
    });
  });
  mqttClient.on('message', function(topic, message) {
    const obj = JSON.parse(message.toString()); // payload is a buffer
    common.log('Plex13319 has received: Alarm13319-1');
    common.log(`Plex13319 message =>${message.toString()}`);
    //Plex13319 message =>{"TransDate":"2020-07-08 12:15"}
    for (let i = 0; i < config.nodes.length; i++) {
      if(config.nodes[i].workcenter_Key!='0'){
        getSetupContainers(obj.TransDate, config.nodes[i].pcn, true, config.nodes[i].workcenter_Key,config.nodes[i].cnc);
        getSetupContainers(obj.TransDate, config.nodes[i].pcn, false, config.nodes[i].workcenter_Key,config.nodes[i].cnc);
      }
    }
  });
}
main();
