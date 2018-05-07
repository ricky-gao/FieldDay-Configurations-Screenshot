"use strict";

var webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  until = webdriver.until,
  Key = webdriver.Key;

var driver;
var stop = 0;
var testconsole;
var testconsoleText = 'document.getElementById("console-prompt").textContent';
const delay = require('delay');

var LocalIP = "";
var usr = 'sonos';
var pwd = 'sonosrocks!'
var testIP = '';
var ipText = '';
var enterDelay = 100;
var presentation = 'AIO';
var devices = new Array;
var allSettings = [];
var displaySettings = [];

window.onload = function() {

  document.getElementById('IPText').value = BrightSignIP;
  initialize();

};

window.onunload = function() {
  //reset();
  if (driver != null) driver.quit();
}

function initialize() {
  $('#waitReboot').hide();
  $('#testingfunctions').hide();
  $('#quickSubmit').hide();
  $('#testingQuickSubmit').hide();
  $('#coverageSection').hide();
  $('#remoteTestingSection').hide();

  $('#findFD').click(function() {
    ipText = document.getElementById('IPText').value;

    if (ValidateIPaddress(ipText)) {
      var url = 'http://' + ipText + ':8008/GetUserVars';

      // make the get request

      var digestRequest = require('request-digest')(usr, pwd);

      digestRequest.requestAsync({
          host: 'http://' + ipText,
          path: '/GetUserVars',
          port: 8008,
          method: 'GET'
        })
        .then(function(response) {
          testIP = ipText;

          const xmlDoc = $.parseXML(response.body);
          const $xml = $(xmlDoc);
          const varlist = {};
          $xml.find('BrightSignVar').each(function() {
            varlist[$(this).attr('name')] = $(this).text();
          });

          var str = '<center style="margin-top: 10px; margin-bottom: 30px">';
          str += '<table id="testinginfoTable"  style="border: 1">';

          for (var [key, val] of iterate_object(varlist)) {
            switch (key.toLowerCase()) {
              case 'exrname':
                str += '<tr><td>ExR System:</td><td>' + val + '</td></tr>';
                break;
              case 'speakermodel':
                str += '<tr><td>Speaker Model:</td><td>' + val + '</td></tr>';
                if (val.includes('HT')) {
                  presentation = 'HT';
                } else {
                  presentation = 'AIO';
                }
                console.log(presentation);
                break;
              case 'exrmodel':
                str += '<tr><td>ExR Model:</td><td>' + val + '</td></tr>';
                break;
              case 'actualplayers':
                str += '<tr><td>Devices:</td><td>' + val + '</td></tr>';
                break;
              case 'locale':
                str += '<tr><td>Language:</td><td>' + val + '</td></tr>';
                break;
              case 'speakerversions':
                str += '<tr><td>Version:</td><td>' + val + '</td></tr>';
                break;
              case 'presentationversion':
                str += '<tr><td>Present Version:</td><td>' + val + '</td></tr>';
                break;
            }
          }

          str += '</table></center>';

          $('#testingFielddayInfo').html(str);

          $('#testingfunctions').show();
        })
        .catch(function(error) {
          alert("Cannot find Brightsign in this IP!")
          console.log(error.statusCode);
          console.log(error.body);
          console.log(error);
        });
    }

    function* iterate_object(o) {
      var keys = Object.keys(o);
      for (var i = 0; i < keys.length; i++) {
        yield [keys[i], o[keys[i]]];
      }
    }
  });

  $('#changesetting').click(function() {
    showChangeSettingSection();
    RetrieveAllSettings();
    delay(2000)
      .then(() => {
        $('#TestingInfo').html('Retrived: ' + allSettings.length + ' settings');
      });
  });

  $('#getpictures').click(function() {
    GetAllPictures(0);
  });

  function hideChangeSettingSection() {
    $('#testingConfigSection').hide();
    $('#testingQuickSubmit').hide();
  }

  function showChangeSettingSection() {
    $('#testingConfigSection').show();
    $('#testingQuickSubmit').show();
    quickConfig({});
    $('#quickSubmit').hide();
  }
}

function RetrieveAllSettings() {

  var languages = $('#language').find('input[type=radio]');
  for (var i = 0; i < languages.length; i++) {
    if (languages[i].id != 'zh-CN') {
      languages[i].click();
      var fixtures = $('#fixture').find('input[type=radio]');
      for (var j = 0; j < fixtures.length; j++) {
        if (fixtures[j].id != 'AdditionalForms') {
          fixtures[j].click();
          var displays = $('#display').find('input[type=radio]');
          for (var k = 0; k < displays.length; k++) {
            if (displays[k].id != 'SimpleDemo') {
              displays[k].click();
              var players = $('#players').find('input[type=radio]');
              for (var l = 0; l < players.length; l++) {
                players[l].click();
                if (fixtures[j].id != 'AIO') {
                  var exclusions = $('#exclusions').find('input[type=radio]');
                  for (var m = 0; m < exclusions.length; m++) {
                    exclusions[m].click();
                    allSettings.push(getSettings());
                    displaySettings.push(languages[i].id + " - " + fixtures[j].id + " - " + displays[k].id + " - " + players[l].id +
                      " - " + exclusions[m].id);
                  }
                } else {
                  allSettings.push(getSettings());
                  displaySettings.push(languages[i].id + " - " + fixtures[j].id + " - " + displays[k].id + " - " + players[l].id);
                }
              }
            }
          }
        }
      }
    }
  }
}

function GetAllPictures(index) {
  $('#TestingInfo').html('Turn off BrightSign Auto Sign');
  TureOffBrightSignAutoSign();

  delay(3000)
    .then(() => {
      $('#TestingInfo').html('Factory Reset Players');
      FactoryResetAllPlayers();

      delay(35000)
        .then(() => {
          $('#TestingInfo').html('Input New Setting ' + displaySettings[index]);
          InputNewSetting(allSettings[index]);

          delay(60000 * 2)
            .then(() => {
              $('#TestingInfo').html('Get ScreenShots');
              GetScreenShots(index);

              if (index < 4) {
                delay(45000)
                  .then(() => {
                    $('#TestingInfo').html('Change to Next');
                    GetAllPictures(index++)
                  });
              }
            });
        });
    });
}

function TureOffBrightSignAutoSign() {
  var request = require("request");
  request("http://" + testIP + ":8008/experience/events/interface/backDoor?command=sonos!sall!disableplayermanagement");
}

function FactoryResetAllPlayers() {
  var request = require("request");
  request("http://" + testIP + ":8008/experience/events/interface/backDoor?command=sonos!sall!factoryreset");
}

function InputNewSetting(current_setting) {

  //==== After 1.8.1 RC2, we have this function ====
  const settings = current_setting;
  //==================================================
  var digestRequest = require('request-digest')(usr, pwd);
  digestRequest.requestAsync({
      host: 'http://' + testIP,
      path: '/SetValues',
      port: 8008,
      method: 'POST',
      form: settings.newSettings,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'Keep-Alive'
      }
    })
    .then(function(response) {
      Console.log("Succes!");
      Console.log(current_setting);

      // document.getElementById("findFD").disabled = true;
      // document.getElementById("IPText").disabled = true;

      // hideCoverageSection();
      // hideRemoteSection();
      // $('#testingQuickSubmit').hide();
      // $('#testingConfigSection').hide();
      // $('#testingfunctions').hide();
      // $('#testingFielddayInfo').html('');

      Reboot();
      $('#TestingInfo').html('Rebooting');
      var tcpp = require('tcp-ping');

      var refreshId = setInterval(function() {
        tcpp.probe(testIP, 8008, function(err, available) {
          if (available) {
            $('#TestingInfo').html('Reboot Complete');

            clearInterval(refreshId);
          }
        });
      }, 2000);
    })
    .catch(function(error) {
      alert("Change Setting Failed!")
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error);
    });
}

function GetScreenShots(index) {
  if (driver == null || testconsole == null) {
    driver = createDriver();
    testconsole = findConsole(driver);
  }

  delay(8000)
    .then(() => {
      openPresent();

      delay(2000)
        .then(() => {
          SkipVideoAIO();

          delay(2000)
            .then(() => {
              TakeScreenShot(index, 'Home')

              delay(2000)
                .then(() => {
                  goPageCompage();

                  delay(2000)
                    .then(() => {
                      ClickAIOCompare();

                      delay(2000)
                        .then(() => {
                          TakeScreenShot(index, 'Compare-AIO-Up');

                          delay(2000)
                            .then(() => {
                              changeWhiteAIO_RTF();

                              delay(2000)
                                .then(() => {
                                  TakeScreenShot(index, 'Compare-AIO-ChangeColor');

                                  delay(2000)
                                    .then(() => {
                                      AIOScrollBottom();

                                      delay(2000)
                                        .then(() => {
                                          TakeScreenShot(index, 'Compare-AIO-Down');

                                          delay(2000)
                                            .then(() => {
                                              ClickHTCompare();

                                              delay(2000)
                                                .then(() => {
                                                  TakeScreenShot(index, 'Compare-HT-Up');

                                                  delay(2000)
                                                    .then(() => {
                                                      changeWhiteHT_RTF();

                                                      delay(2000)
                                                        .then(() => {
                                                          TakeScreenShot(index, 'Compare-HT-ChangeColor');

                                                          delay(2000)
                                                            .then(() => {
                                                              HTScrollBottom();

                                                              delay(2000)
                                                                .then(() => {
                                                                  TakeScreenShot(index, 'Compare-HT-Down');

                                                                  delay(2000)
                                                                    .then(() => {
                                                                      ClickComponentCompare();

                                                                      delay(2000)
                                                                        .then(() => {
                                                                          TakeScreenShot(index, 'Compare-COMP-Up');

                                                                          delay(2000)
                                                                            .then(() => {
                                                                              changeSideCOMP_RTF();

                                                                              delay(2000)
                                                                                .then(() => {
                                                                                  TakeScreenShot(index, 'Compare-COMP-ChangeColor');

                                                                                  delay(2000)
                                                                                    .then(() => {
                                                                                      ComponentsScrollBottom();

                                                                                      delay(2000)
                                                                                        .then(() => {
                                                                                          TakeScreenShot(index, 'Compare-COMP-Down');

                                                                                          delay(1000)
                                                                                            .then(() => {
                                                                                              reset();

                                                                                              delay(500)
                                                                                                .then(() => {
                                                                                                  if (driver != null) driver.quit();
                                                                                                });
                                                                                            });
                                                                                        });
                                                                                    });
                                                                                });
                                                                            });
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

function TakeScreenShot(index, name) {
  var request = require("request");
  request("http://" + testIP + ":8008/experience/events/interface/snapshot?name=" + displaySettings[index] + "-" + name);
}

// To validate the IP address a user put in
function ValidateIPaddress(ipaddress) {
  if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
    return (true)
  }
  alert("You have entered an invalid IP address!")
  return (false)
}

function Reboot() {
  var request = require("request");
  request("http://" + testIP + ":8008/experience/events/interface/reboot");
}
