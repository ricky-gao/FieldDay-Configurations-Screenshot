"use strict";

/* ========================================
 *
 * Copyright Sonos, 2018
 * All Rights Reserved
 * UNPUBLISHED, LICENSED SOFTWARE.
 *
 * CONFIDENTIAL AND PROPRIETARY INFORMATION
 * WHICH IS THE PROPERTY OF Sonos.
 *
 * ========================================
**/

var Query = document.location.search.replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this;}.bind({}))[0];

var Host     = (location.protocol === 'file:') ? 'localhost' : location.hostname;
var Protocol = (location.protocol === 'file:') ? 'http:' : location.protocol;
var Port     = (location.protocol === 'file:') ? '8008' : location.port;
var VarsHost  = `${Protocol}//${Host}:${Port}/GetUserVars`;
var RebootCmd = `${Protocol}//${Host}:${Port}/experience/events/interface/reboot`;
var SetValsCmd = `${Protocol}//${Host}:${Port}/SetValues`;

var Debug = false;

// Simple Demo Config:
var IsSimpleDemo;
var HarnessButtonCount;
var GroupNames = ['language', 'fixture', 'display', 'player', 'exclusion'];
var CurrentGroup = 0;
var UserVars;
var HijackEnabled;
var WiFiEnabled;

var ServerTime;
var ServerTimeString;
var ServerStatus;

var BrightSignMessageExchange;
var EnableExperimentalFeatures = false;
var EnableRapidConfig = false;

var IsWebDemoMode = (localStorage && localStorage.localSetup && localStorage.vars);
var IsRunningOnBrightSign = false;
if (typeof(CloseAllBSClasses) === 'function') {
  CloseAllBSClasses(true);
  IsRunningOnBrightSign = true;
}

function efficientGet(errorCallback, dataCallback, sUrl)
{
  $.ajax({
    url: sUrl,
    error: errorCallback,
    success: function(data,status,jqXHR) {
      dataCallback(jqXHR.responseText);
    },
  });
}

function efficientGetUserVars(callback, sUrl)
{
  sUrl = typeof sUrl !== 'undefined' ? sUrl : "/GetUserVars";
  efficientGet(callback, function(un) {
    const xmlDoc = $.parseXML(un);
    const $xml = $(xmlDoc);
    const varlist = {};
    $xml.find('BrightSignVar').each(function() {
      varlist[$(this).attr('name')] = $(this).text();
    });
    callback(varlist);
  }, sUrl);
}

function doGetConfigVars(timeout) {
  if (Query.setup === 'Local') {
    doUserVars({});
    return;
  } else if (Query.setup === 'LocalTune') {
    // Get the current local date/time, but in ISO format
    const now = new Date();
    const localDate = now/1000 - now.getTimezoneOffset() * 60;
    const isoDateTimeParts = (new Date(localDate * 1000)).toISOString().split(/[Z\.]/);
    const isoDateTime = isoDateTimeParts[0];

    const defaults = {
      collateralDefinition: '',
      startingVolumeSetting: '',
      maxVolumeSetting: '',
      sessionTimeoutDefault: '',
      reResetInterval: '',
      promo: '',
      promoAStart: '',
      promoBEnd: '',
      currentDT: isoDateTime,
    };
    const vars = Object.assign({}, defaults, JSON.parse(localStorage.vars || '{}'));
    doUserVars(vars);
    return;
  }
  setTimeout(function() { efficientGetUserVars(doUserVars, VarsHost); }, timeout);
}

function getTopologyOnce() {
  getMethodFromBrightSign('sonosData', function (data, textStatus, jqXHR) {
    extractServerTime(data);
    console.log(`Time Server Status: ${ServerStatus}`);
    ServerStatus = ServerStatus ? '' : 'Auto';
  }, function(jqXHR, textStatus) {
    doGetConfigVars(2000);
  }, null, 'json');
}

function getMethodFromBrightSign(getUrl, successCB, completeCB, errorCB, dataType) {
  $.ajax({
    url: `${Protocol}//${Host}:${Port}/experience/events/interface/${getUrl}`,
    dataType: dataType || 'html',
    success: successCB,
    error: (function(jqXHR, textStatus, errorThrown) {
      if (jqXHR.status == 0) return;
      const responseText = jqXHR.responseText && jqXHR.responseText.substr(0, 255) || '';
      $.confirm({
        title: 'BrightSign method failure',
        content: `Get from BrightSign method failed: statusCode=${jqXHR.status}
                  ${textStatus}-${errorThrown}: ${responseText}`,
        buttons: {
          ok: function () { if (errorCB) errorCB(); },
        },
        useBootstrap: false,
        backgroundDismiss: function () { return 'ok'; },
      });
    }),
    complete: completeCB,
  });
}

function extractServerTime(data) {
  ServerTime = null;
  ServerTimeString = null;
  ServerStatus = "No time data";

  const time = data.time;
  if (!time) return;

  ServerStatus = "No time";
  if (!time.time) return;

  ServerTime = new Date(time.time * 1000);
  const isoDateTimeParts = ServerTime.toISOString().split(/[Z\.]/);
  ServerTimeString = isoDateTimeParts[0];

  if (!time.server) {
    ServerStatus = "Can't see timeserver";
    return;
  }

  if (!time.server.success_timestamp) {
    ServerStatus = "No time from timeserver";
    return;
  }
  if (time.server.failure_reason) {
    ServerStatus = time.server.failure_reason;
    return;
  }

  ServerStatus = '';
}

$(document).ready(function() {
  // We use BrightSign communications to get the Simple Demo button pushes
  // if (IsRunningOnBrightSign) {
  //   setTimeout(initializeBrightSignCommunications, 250);
  //   getTopologyOnce();
  // } else {
  //   doGetConfigVars(2000);
  // }
});

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function doReboot(delay) {
  if (Query.setup === 'LocalTune') {
    window.location = '../Field%20Day%20-%20HTML/Field%20Day.html';
    return false;
  }
  $('.control').prop('disabled', true).html('Please wait...');
  $('button').prop('disabled', true);
  setTimeout(function() {
    window.location.href = RebootCmd;
  }, delay || 200);
  return false;
}

function doSubmit() {
  if (Query.setup === 'LocalTune') {
    const vars = JSON.parse(localStorage.vars);
    const values = $("form").serializeArray();
    for (const value of values) {
      vars[value.name] = value.value;
    }
    localStorage.vars = JSON.stringify(vars);
    return false;
  }
  $('.control').prop('disabled', true).html('Please wait...');
  $('button').prop('disabled', false);
  setTimeout(function () {
    $('form').submit();
    const $currentDT = $('input[name=currentdt]');
    const newTimeStr = $currentDT.val();
    console.log(`Considering setting time to: ${newTimeStr}`);
    // We don't want to try to set the time unless
    if (newTimeStr == ServerTimeString) {
      console.log('The user did not change the time');
    } else if (newTimeStr.indexOf('[') > -1 || newTimeStr.indexOf(']') > -1) {
      console.log('The time has [Auto], indicating we should leave the time server time');
    } else {
      console.log(`Trying to set time to: ${newTimeStr}`);
      const newTime = new Date(newTimeStr);
      if (isNaN(newTime)) {
        console.log('The time does not have a valid format');
      } else {
        const epoch = newTime.getTime() / 1000;
        console.log(`Found time's epoch: ${epoch}`);
        getMethodFromBrightSign(`setTime?time=${epoch}`, null, null, null, 'json');
      }
    }
  }, 200);
  return false;
};

function doReconfig() {
  $('.control').prop('disabled', true).html('Please wait...');
  $('button').prop('disabled', true);
  setTimeout(function() {
    window.location.href = '/?setup=Menu';
  }, 200);
}

function doReauth() {
  $('.control').prop('disabled', true).html('Please wait...');
  $('button').prop('disabled', true);
  setTimeout(function() {
    window.location.href = '/config.html';
  }, 200);
}

function updateToggles(us) {
  if (us) {
    processUpdateToggles(us);
  } else {
    efficientGetUserVars(processUpdateToggles, VarsHost);
  }
}

let UpdateTogglesTimer;

function processUpdateToggles(us) {
  if (us) enableToggles(us);
  getMethodFromBrightSign('backDoor?command=sonos!sall!readglistatus');
  UpdateTogglesTimer = setTimeout(function() {
    updateToggles();
  }, 60000);
}

function cancelUpdateToggles() {
  if (UpdateTogglesTimer) {
    clearTimeout(UpdateTogglesTimer);
    UpdateTogglesTimer = null;
  }
}

function doUserVars(us) {
  if (!us)
  {
    console.log("userVars not defined");
    doGetConfigVars(1000);
    return;
  }
  UserVars = us;
  $('#version').text(us.presentationversion || us.presentationVersion);

  var keyValue = document.cookie.match('(^|;) ?brightsign=([^;]*)(;|$)');
  if (!(keyValue && keyValue[2] && keyValue[2] === `${us.browserToken}-${us.bootCount}`)) {
    if (!IsRunningOnBrightSign && Query.setup !== 'Local' && Query.setup != 'LocalTune') doReauth();
  }

  if (ServerTime){
    const err = ServerStatus ? `[${ServerStatus}] ` : '';
    us.currentdt = `${err}${ServerTimeString}`;
  }

  EnableExperimentalFeatures = (us.enableExperimentalFeatures === 'true');
  if (IsWebDemoMode) EnableExperimentalFeatures = true;
  EnableRapidConfig = (us.enableRapidConfig === 'true');

  IsSimpleDemo = (IsRunningOnBrightSign && us.simpleDemoButtonSetup === 'true');
  IsSimpleDemo = (IsSimpleDemo || Query.simple === 'true');
  const quick = (Query.setup === 'Quick' || Query.setup === 'Local' ||
                 us.ExRModel === '' && Query.setup !== 'Full');
  const menu = (Query.setup === 'Menu');
  const tune = (Query.setup === 'Tune' || Query.setup === 'LocalTune');

  if (!IsSimpleDemo) {
    displayQRData(us, quick || menu || tune);
  } else {
    $('#QRCodes').hide();
  }

  if (!tune) {
    $('link[jqui="true"]').remove();
  }

  $('.ui-loader.ui-loader-default').hide();

  if (IsSimpleDemo) {
    buildQueryForButtonHarness('#quickConfigContainer');
    $('#longConfig, #wait').html('');
  } else if (quick) {
    quickConfig(us);
  } else if (menu) {
    menuConfig(us);
  }
  else {
    if (tune) {
      tuneConfig(us);
    } else {
      normalConfig(us);
    }

    if (IsRunningOnBrightSign) {
      $('input').keyboard({
        layout: 'custom',
        customLayout: {
          'normal': [
            '1 2 3 4 5 6 7 8 9 0 - = {bksp}',
            '{sp:2} q w e r t y u i o p [ ] \\',
            '{sp:1} a s d f g h j k l ; \' {accept}',
            '{shift} z x c v b n m , . / ` {shift}',
            '{sp:11} {left} {space} {right} {sp:1} {del} {sp:7} {cancel}'
          ],
          'shift': [
            '! @ # $ % ^ & * ( ) _ + {bksp}',
            '{sp:2} Q W E R T Y U I O P { } |',
            '{sp:1} A S D F G H J K L : " {accept}',
            '{shift} Z X C V B N M < > ? ~ {shift}',
            '{sp:11} {left} {space} {right} {sp:1} {del} {sp:7} {cancel}'
          ]
        },
        keyBinding : 'touchstart',
        autoAccept: true,
        visible: function(e, keyboard, el) {
          const label = $(el).parents('td').first().prev().prev().html();
          const preview = `<span class"ui-keyboard-preview-label">${label}: &nbsp;</span>`;
          $('.ui-keyboard-preview-wrapper').prepend(preview);
        }
      });
    }
  }
}

function buildMenuScaffolding(jqSelector) {
  $(jqSelector).html(`
<style>
.menu-button {
  display: block;
  width: 140px;
  height: 50px;
  background: silver;
  margin: 15px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 110%;
}
table.statusTable td {
  padding-left: 5px;
  padding-right: 5px;
}
</style>
    <div id="quickMenu" style="display: none; width=800px;">
        <table style="width: 960px;" class="menu">
            <tr>
              <td width="10%"><button id="button-reconfig" class="menu-button">Reconfigure</td>
              <td width="40%">Reconfigure this system</td>
              <td width="10%"><button id="button-tuning" class="menu-button">Tuning</td>
              <td width="40%">Change collateral or default volume</td>
            </tr>
            <tr>
              <td><button id="button-data" class="menu-button" disabled="disabled">Data</td>
              <td>Data gathering</td>
              <td><button id="button-reboot" class="menu-button">Reboot</td>
              <td>Reboot this display</td>
            </tr>
            <tr>
              <td><button id="button-reset" class="menu-button" disabled="disabled">Reset</td>
              <td>Factory reset Sonos players</td>
              <td>
                  <button id="button-hijack" class="menu-button" disabled="disabled">Hijack
                  <span class="hijackOn" style="display:none">On</span>
                  <span class="hijackOff"style="display:none">Off</span>
              </td>
              <td>
                  <span class="hijackOn" style="display:none">Prepare for Hijack Mode</span>
                  <span class="hijackOff" style="display:none">Remove Hijack Mode</span>
              </td>
            </tr>
            <tr class="hijackOff" style="display:none">
              <td class="hijackOff"><button id="button-auth" class="menu-button">Mic Auth</td>
              <td class="hijackOff">Set/check Sonos microphone control authorization</td>
              <td class="hijackOff"><button id="button-config" class="menu-button">Config Household</td>
              <td class="hijackOff">Enable buttons / Join Sonos controller</td>
            </tr>
            <tr>
              <td class="firmwareMenu" style="display:none">
                  <button id="button-firmware" class="menu-button">Firmware
              </td>
              <td class="firmwareMenu" style="display:none">Use the Sonos firmware utility</td>
              <td class="wifiMenu" style="display:none">
                  <button id="button-wifi" class="menu-button" disabled="disabled">WiFi
                  <span class="wifiOn" style="display:none">On</span>
                  <span class="wifiOff" style="display:none">Off</span>
              </td>
              <td class="wifiMenu" style="display:none">
                  <span class="wifiOn" style="display:none">Turn on display's WiFi</span>
                  <span class="wifiOff" style="display:none">Turn off display's WiFi</span>
              </td>
            </tr>
        </table>
       <div id="returnToAuth"></div>
       <br>
       <table id="variablesTable" class="statusTable">
       </table>
       <br>
       <table id="firmwareTable" class="statusTable">
         <tr>
           <th id="topoStatus">Please wait...</th>
         </tr>
       </table>
    </div>
`);
}

function getTopology() {
  getMethodFromBrightSign('sonosData', function (data, textStatus, jqXHR) {
    processTopology(data);
  }, function(jqXHR, textStatus) {
    renewTopology();
  }, null, 'json');
}

var Timer;

function renewTopology() {
  clearTimeout(Timer);
  Timer = setTimeout(function() {
    getTopology();
  }, 2000);
}

var initialSonosEnableDone;

function processTopology(data) {
  const tune = (Query.setup === 'Tune' || Query.setup === 'LocalTune');
  if (tune) {
    if (!data.time.local) return;
    // The BrightSign gives the time as number of seconds since 1970-01-01 so the results
    // are consistent regardless of the local date/time formats.
    const dataTime = new Date(data.time.local * 1000);
    const isoDateTimeParts = dataTime.toISOString().split(/[Z\.]/);
    const isoDateTime = isoDateTimeParts[0];
    const $currentDT = $('input[name=currentdt]');
    $currentDT.val(isoDateTime);
    return;
  }

  const sonosButtons = '#button-data, #button-reset, #button-hijack, #button-auth, ' +
                       '#button-config, #button-wifi';
  if (!data.complete) {
    $(sonosButtons).attr('disabled', 'disabled');
  } else if (!initialSonosEnableDone) {
    $(sonosButtons).removeAttr('disabled');
    $('.not-complete').hide();
    initialSonosEnableDone = true;
  }

  if (data.complete) $('#setup').hide();
  if (!data.devices) {
    $('#topoStatus').html('Sonos device discovery was not started');
    return;
  }

  const $firmwareTable = $('#firmwareTable');
  let row = '<tr><th>Zone</th><th>Device</th><th>IP</th><th>HHID</th><th>Firmware</th></tr>';
  $firmwareTable.html(row);

  for (let deviceName in data.devices) {
    const device = data.devices[deviceName];
    const modelActual = device.modelactual;
    const swVersion = device.softwareversion;
    const zone = device.zone.toUpperCase();
    const hhid = device.hhid;
    const ip = device.baseurl.replace('http://', '').replace(':1400', '');

    row = '<tr class="border"><td colspan="5"></td></tr>';
    row += `<tr><td>${zone}</td><td>${modelActual}</td><td>${ip}</td>` +
           `<td>${hhid}</td><td>${swVersion}</td></tr>`;
    $firmwareTable.append(row);
  }
  row = '<tr class="border"><td colspan="5"></td></tr>';
  $firmwareTable.append(row);
}

function jqConfirm(callback) {
  $.confirm({
    title: 'Are you sure?',
    content: 'This will factory reset all the players that this display is configured to manage.  Are you sure you want to do this?',
    buttons: {
      yes: callback,
      no: function () {},
    },
    useBootstrap: false,
    backgroundDismiss: function() { return 'no'; },
  });
}

function enableToggles(us) {
  HijackEnabled = !((us.RDMMode || us.rdmmode) === 'yes');
  $('.hijackOn').toggle(!HijackEnabled);
  $('.hijackOff').toggle(HijackEnabled);

  const gliData = (typeof(us.gliStatus) === 'string') && us.gliStatus.split(':') || [];
  WiFiEnabled = gliData[10];
  $('.wifiOn').toggle(!Number(WiFiEnabled));
  $('.wifiOff').toggle(!!Number(WiFiEnabled));
  $('.wifiMenu').toggle(typeof(WiFiEnabled) !== 'undefined');
  $('#button-wifi').removeAttr('disabled');
}

function menuConfig(us) {
  buildMenuScaffolding('#quickConfigContainer');
  $('#longConfig').html('');
  $('#wait').html('');
  $('#quickMenu').show();
  $('.unhideBaseQR').show();
  $('.varform').css('width', '100%');

  getMethodFromBrightSign('backDoor?command=sonos!sall!readglistatus');
  getMethodFromBrightSign('backDoor?command=sonos!sall!disableplayermanagement', getTopology);

  if (IsRunningOnBrightSign) {
	const ret = '&nbsp;&nbsp;&nbsp;<button class="control" href="#" id="reauth"' +
          'onclick="return doReauth();">Return to Authentication</button>';
    $('#returnToAuth').html(`<br><br>${ret}<br><br>`);
  }

  let debug = {};
  try {
    debug = JSON.parse(us.debugPrint);
  } catch (ex) {
    console.log('Could not parse debugPrint options');
  }

  const firmware = debug.firmware;
  $('.firmwareMenu').toggle(firmware);

  updateToggles(us);

  $('#quickConfigContainer').on('click', '#button-reconfig', function() {
    $('.menu-button').attr('disabled', 'disabled');
    window.location.href = document.location.href.replace('Menu', 'Quick');
  });
  $('#quickConfigContainer').on('click', '#button-tuning', function() {
    $('.menu-button').attr('disabled', 'disabled');
    window.location.href = document.location.href.replace('Menu', 'Tune');
  });
  $('#quickConfigContainer').on('click', '#button-data', function() {
    $('.menu-button').attr('disabled', 'disabled');
    window.location.href = '/BootStatus.html';
  });
  $('#quickConfigContainer').on('click', '#button-auth', function() {
    $('.menu-button').attr('disabled', 'disabled');
    window.location.href = '/SonosAuthenticate.html';
  });
  $('#quickConfigContainer').on('click', '#button-config', function() {
    const url = 'enterHijack';
    getMethodFromBrightSign(url, function() {
      $('#button-config').attr('disabled', 'disabled');
    });
  });
  $('#quickConfigContainer').on('click', '#button-reboot', function() {
    $('.menu-button').attr('disabled', 'disabled');
    setTimeout(function() {
      window.location.href = RebootCmd;
    },100);
  });
  $('#quickConfigContainer').on('click', '#button-reset', function() {
    jqConfirm(function() {
      $('.menu-button,#reauth').attr('disabled', 'disabled');
      const url = 'backDoor?command=sonos!sall!disablehouseholdmanagement';
      getMethodFromBrightSign(url, function() {
        const url = 'backDoor?command=sonos!sall!factoryreset';
        getMethodFromBrightSign(url, function() {
          $('#button-reconfig').removeAttr('disabled');
          $('#button-reboot').removeAttr('disabled');
        });
      });
    });
  });
  $('#quickConfigContainer').on('click', '#button-hijack', function() {
    cancelUpdateToggles();
    const toggleHijack = function() {
      const url = `toggleRDM?rdm=${HijackEnabled ? 'yes' : 'no'}`;
      getMethodFromBrightSign(url, function() {
        $('#button-reboot').removeAttr('disabled');
        $.confirm({
          title: 'BrightSign Rebooting',
          content: 'The display will now reboot to prepare the selected Hijack mode',
          buttons: {
            ok: function () {},
          },
          useBootstrap: false,
          backgroundDismiss: true, // this will just close the modal
        });
      });
    };
    let success;
    let complete;
    let error;
    if (HijackEnabled) {
      complete = toggleHijack;
    } else {
      success = toggleHijack;
      error = function() { window.location.reload(); };
    }
    jqConfirm(function() {
      $('.menu-button').attr('disabled', 'disabled');
      const url = `toggleWiFi?enable=${!HijackEnabled}`;
      getMethodFromBrightSign(url, success, complete, error);
    });
  });
  $('#quickConfigContainer').on('click', '#button-wifi', function() {
    cancelUpdateToggles();
    $('#button-wifi').attr('disabled', 'disabled');
    const url = `toggleWiFi?enable=${!Number(WiFiEnabled)}`;
    getMethodFromBrightSign(url, function() {
      setTimeout(function() {
        getMethodFromBrightSign('backDoor?command=sonos!sall!readglistatus', function() {
          setTimeout(updateToggles, 10000);
        });
      }, 10000);
    });
  });
  $('#quickConfigContainer').on('click', '#button-firmware', function() {
    $('.menu-button').attr('disabled', 'disabled');
    window.location.href = '/Firmware.html';
  });

  $('.unhideBaseQR').click(function() {
    $('#QRCodes').show();
    $('.unhideBaseQR').hide();
    setTimeout(function() {
      $('html,body').scrollTop($(document).height());
    }, 100);
  });

  const varRowSep = '<tr class="border"><td colspan="2"></td></tr>';
  const addBSVariable = function ($table, us, varName) {
    const val = (us[varName] || us[varName.toLowerCase()] || '');
    $table.append(`${varRowSep}<tr><td>${varName}</td><td>${val}</td></tr>}`);
  };

  setTimeout(function() {
    const $variablesTable = $('#variablesTable');
    let row = varRowSep;
    if (!initialSonosEnableDone) {
      row += '<tr class="not-complete"><td colspan="2" style="color:red;">Sonos device discovery is not yet complete.</td></tr>';
      $variablesTable.html(row);
    } else {
      $variablesTable.html('');
    }

    addBSVariable($variablesTable, us, 'SerialNumber');
    addBSVariable($variablesTable, us, 'brightSignIP');
    addBSVariable($variablesTable, us, 'firmwareVersion');
    addBSVariable($variablesTable, us, 'activePresentation');
    addBSVariable($variablesTable, us, 'ExRModel');
    addBSVariable($variablesTable, us, 'SpeakerModel');
    $variablesTable.append(varRowSep);
  }, 100);
}

function buildQuickConfigScaffolding(jqSelector) {
  const localTune = (Query.setup !== 'Local') ? '' : `&nbsp;&nbsp;&nbsp;&nbsp;
        <button type="submit" class="control" id="quickTune">Save values and tune</button>`;

  $(jqSelector).html(`
    <div id="quickConfig" style="display: none;">
        <table style="width: 1230px;height: 636px;" class="quick">
            <tr class="init">
                <th>Language<!-- add for Locale: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Locale --></th>
                <td>&nbsp;</td>
                <th>Fixture</th>
                <td>&nbsp;</td>
                <th>Touch Screen</th>
                <td>&nbsp;</td>
                <th>Players</th>
            </tr>
            <tr>
                <td id="language" width="5%" rowspan="3"></td>
                <td rowspan="3">&nbsp;&nbsp;&nbsp;</td>
                <td id="fixture" width="20%""></td>
                <td>&nbsp;</td>
                <td id="display" width="30%"></td>
                <td rowspan="3">&nbsp;</td>
                <td id="player" width="35%" rowspan="3"></td>
            </tr>
            <tr height="100%" rowspan="2">
                <td id="exclusion-list" colspan="3" style="display:none;">
                    <div>
                        <b>Video Exclusions:</b><br>
                        <div id="exclusion">
                        </div>
                    </div>
                </td>
            </tr>
        </table>
        <br>
        <div id="rapidConfig">
          <input type="checkbox" id="rdmOff">Start with Hijack On (Retail Display Mode Off)
        </div>
        <br>
        <button class="control" id="reboot">Reboot without saving</button>&nbsp;&nbsp;&nbsp;&nbsp;
        <button type="submit" class="control" id="quickSubmit">Save values and reboot</button>
        ${localTune}
    </div>
`);
}

function buildQueryForButtonHarness(jqSelector) {
  $(jqSelector).html(`
    <div id="buttonSelect">
        <h2>
            Please push the "Learn More" button so that<br>
            we can determine which style button harness<br>
            is on this display.
        </h2>
        <h3>
            Note: During setup, you will use the following buttons:<br><br>
            <table>
              <tr>
               <td>Vol -/+</td><td>&nbsp;</td><td>Move down/up the current option list</td>
             </tr>
             <tr>
               <td>Music</td><td>&nbsp;</td><td>Select next option list</td>
             </tr>
             <tr>
               <td>Video</td><td>&nbsp;</td><td>Select previous option list</td>
             </tr>
             <tr>
               <td>Learn</td><td>&nbsp;</td><td>Save Values and Reboot</td>
             </tr>
        </h3>
    </div>
  `);
  $(jqSelector).on('click', function() {
    HarnessButtonCount = 6; // Arbitrary - this is used for testing only
    $(jqSelector).off('click');
    setTimeout(function() { quickConfig(UserVars); }, 50);
  });
  // We have nothing more to do - when the user presses the next button, we'll continue
}

function quickConfig(us) {
  buildQuickConfigScaffolding('#quickConfigContainer');
  $('#longConfig').html('');
  $('#wait').html('');
  $('#quickConfig').show();
  $('.unhideBaseQR').show();
  $('.varform').css('width', '100%');
  $('#reboot').toggle(!IsSimpleDemo);

  $('#quickSubmit,#quickTune').prop('disabled', true);

  if (EnableExperimentalFeatures) {
    // Enable experimental features
    for (const langConfig in QuickConfig.languageConfigs) {
      QuickConfig.languageConfigs[langConfig].Experimental = true;
    }
  }
  if (!EnableRapidConfig) {
    $('#rapidConfig').hide();
  }
  const useLocale = false;
  let html = useLocale ? '<table class="lang">' : '';
  let idx = 0;
  for (const lang of QuickConfig.languages) {
    const inp = `<input type="radio" name="language" value="${idx++}" id="${lang.locale}">`;
    const loc = `<label for="${lang.locale}">${lang.locale}</label>`;
    const lab = `<label for="${lang.locale}">${lang.label}</label>`;
    if (useLocale) {
      html += `<tr><td>${inp} ${lab}</td></tr><td>${loc}</td>`;
    } else {
      html += `${inp} ${lab}<br>`;
    }
  }
  if (useLocale) html += '</table>';
  $('#language').html(html);

  html = '';
  for (const exclusion of QuickConfig.videoExclusions) {
    const collat = exclusion.collateralDefinition;
    const type = exclusion.type;
    const select = exclusion.default ? 'checked="checked"' : '';
    const inp = `<input type="radio" name="exclusion" value="${collat}" id="${type}" ${select}>`;
    const lab = `<label for="${type}">${exclusion.name}</label>`;
    html += `${inp} ${lab}<br>`;
  }
  $('#exclusion').html(html);

  $('.unhideBaseQR').click(function() {
    $('#QRCodes').show();
    $('.unhideBaseQR').hide();
    setTimeout(function() {
      $('html,body').scrollTop($(document).height());
    }, 100);
  });

  $('#quickConfig').on('change', 'input', onChangeQuickConfig);

  $('#reboot').click(function() {
    const button = this;
    doReboot(500);
  });

  $('#quickSubmit,#quickTune').click(function(ev) {
    const button = this;
    const settings = getSettings();
    if (QuickConfig.languages[settings.localeIdx].configFun) {
      QuickConfig.languages[settings.localeIdx].configFun(settings.newSettings);
    }
    $('#reboot').attr('disabled', 'disabled');
    if (Query.setup !== 'Local') {
      $.ajax({
        type: "POST",
        url: SetValsCmd,
        data: settings.newSettings,
      }).done(function(data, textStatus, jqXHR) {
          doReboot(2000);
        })
        .fail(function(jqHXR, textStatus, errorThrown) {
          $.confirm({
            title: 'Change submission failure',
            content: `Changes failed: statusCode=${jqXHR.status} ${textStatus}-${errorThrown}`,
            buttons: {
              ok: function () {},
            },
            useBootstrap: false,
            backgroundDismiss: true, // this will just close the modal
          });
        });
    } else {
      localStorage.vars = JSON.stringify(settings.newSettings);
      localStorage.localSetup = true;
      window.location = ev.currentTarget.id === 'quickTune'
        ? 'index.html?setup=LocalTune'
        : '../Field%20Day%20-%20HTML/Field%20Day.html';
    }
  });
  highlightCurrentGroup();
}

var LastLanguage;
var LastFixture;
var LastDisplay;

function onChangeQuickConfig() {
  let changed = false;
  const $language = $('input[name=language]:checked');
  if (LastLanguage != $language.val()) {
    LastLanguage = $language.val();
    changed = true;

    $('#fixture').html('');
    $('#display').html('');
    $('#player').html('');
    LastFixture = undefined;
    LastDisplay = undefined;
    const langConfig = QuickConfig.languages[+LastLanguage].config;
    const langConfigs = QuickConfig.languageConfigs[langConfig];
    let okCnt = 0;
    for (const name in QuickConfig.fixtureConfigs) {
      const config = QuickConfig.fixtureConfigs[name];
      const simpleDemo = config.displayConfigs && config.displayConfigs['Simple Demo'];
      config.isOK = (langConfigs[name] &&
                     !(IsSimpleDemo && (!simpleDemo || !simpleDemo.simpleDemoButtonCounts ||
                                        !simpleDemo.simpleDemoButtonCounts[HarnessButtonCount])));
      if (config.isOK) okCnt++;
    }
    let br = '';
    const checked = okCnt > 1 ? '' : ' checked="checked"';
    for (const name in QuickConfig.fixtureConfigs) {
      const config = QuickConfig.fixtureConfigs[name];
      if (!langConfigs[name]) continue;
      if (!config.isOK) continue;
      const fixtureName = config.displayName;
      const quickName = fixtureName.replace(/[, ]/g, '');
      const html = `<input type="radio" name="fixture" value="${name}" id="${quickName}"` +
            `${checked}><label for="${quickName}">${fixtureName}</label>`;
      $('#fixture').append(br + html);
      br = '<br>';
    }
  }

  const $fixture = $('input[name=fixture]:checked');
  if (LastFixture != $fixture.val()) {
    LastFixture = $fixture.val();
    changed = true;

    $('#display').html('');
    $('#player').html('');
    LastDisplay = undefined;
    let br = '';
    const configs = QuickConfig.fixtureConfigs[LastFixture].displayConfigs;
    let okCnt = 0;
    for (const name in configs) {
      const config = configs[name];
      config.quickName = name.replace(/[, ]/g, '');
      config.isOK = (!IsSimpleDemo || name === 'Simple Demo');
      if (config.isOK) okCnt++;
    }
    const checked = okCnt > 1 ? '' : ' checked="checked"';
    for (const name in configs) {
      const config = configs[name];
      const displayName = name;
      const quickName = config.quickName;
      if (!config.isOK) continue;
      const html = `<input type="radio" name="display" value="${name}" id="${quickName}"` +
            `${checked}>` +
            `<label for="${quickName}">${displayName}</label>`;
      $('#display').append(br + html);
      br = '<br>';
    }
    const enableExclusions = $fixture.attr('id') === 'HT' && !IsSimpleDemo;
    if ($('#exclusion').html() != '') $('#exclusion-list').toggle(enableExclusions);
  }

  const $display = $('input[name=display]:checked');
  if (LastDisplay != $display.val()) {
    LastDisplay = $display.val();
    changed = true;

    $('#player').html('');
    let br = '';
    const configs = QuickConfig.fixtureConfigs[LastFixture]
                               .displayConfigs[LastDisplay]
                               .playerConfigs;
    let okCnt = 0;
    for (const name in configs) {
      const config = configs[name];
      config.quickName = name.replace(/[, ]/g, '');
      config.isOK = (!IsSimpleDemo || !config.values ||
                     config.values.simpleDemoButtonCount == HarnessButtonCount);
      if (config.isOK) okCnt++;
    }
    const checked = okCnt > 1 ? '' : ' checked="checked"';
    for (const name in configs) {
      const config = configs[name];
      const playerName = name;
      const quickName = playerName.replace(/[, ]/g, '');
      if (!config.isOK) continue;
      const html = `<input type="radio" name="player" value="${name}" id="${quickName}"` +
            `${checked}>` +
            `<label for="${quickName}">${playerName}</label>`;
      $('#player').append(br + html);
      br = '<br>';
    }
  }

  const $player = $('input[name=player]:checked');

  $('#quickSubmit,#quickTune').prop('disabled',
                                    !($fixture.length &&
                                      $display.length &&
                                      $player.length &&
                                      $language.length));
}

function highlightCurrentGroup() {
  if (!IsSimpleDemo) return;
  $('.simpleDemoSelected').removeClass('simpleDemoSelected');
  $(`#${GroupNames[CurrentGroup]}`).addClass('simpleDemoSelected');
}

//
// Initialize BrightSign communications
//

function initializeBrightSignCommunications() {
  BrightSignMessageExchange = new BSMessagePort();
  BrightSignMessageExchange.onbsmessage = processBrightSignMessage;
}

function processBrightSignMessage(msg) {
  const data = msg.data;
  if (!data) {
    console.log("Malformed data received from BrightSign");
    return;
  }
  const message = data.sendMessage || data.sendmessage;
  if (Debug) console.log(`Got JS Message: ${message}`);
  switch (message) {
    // Simple Demo Buttons
    case 'displayButton':
      processSimpleDemoButton(data.buttonName, data.buttonAction);
      break;

    default:
      console.log("==========> Unhandled message: ");
      console.log(JSON.stringify(data, null, 2));
  }
}

var ButtonMap = {
  '5': {
    'GPIO0' : 'LEARN',
    'GPIO1' : 'VIDEO',
    'GPIO2' : 'VOL_UP',
    'GPIO5' : 'MUSIC',
    'GPIO6' : 'VOL_DOWN',
  },
  '6': {
    'GPIO0' : 'SUB',
    'GPIO1' : 'LEARN',
    'GPIO2' : 'VOL_UP',
    'GPIO4' : 'VIDEO',
    'GPIO5' : 'MUSIC',
    'GPIO6' : 'VOL_DOWN',
  },
};

function processSimpleDemoButton(buttonName, buttonAction) {
  if (!HarnessButtonCount) {
    switch (buttonName) {
    case 'GPIO0':
      HarnessButtonCount = '5';
      break;
    case 'GPIO1':
      HarnessButtonCount = '6';
      break;
    }
    if (HarnessButtonCount) setTimeout(function() { quickConfig(UserVars); }, 50);
    return;
  }

  const xlatedButton = ButtonMap[HarnessButtonCount][buttonName];

  let $el, $all;
  switch (xlatedButton) {
  case 'MUSIC':
    $el = $(`input[name=${GroupNames[CurrentGroup]}]:checked`);
    if ($el.length) CurrentGroup < GroupNames.length - 1 && CurrentGroup++;
    highlightCurrentGroup();
    break;
  case 'VIDEO':
    CurrentGroup && CurrentGroup--;
    highlightCurrentGroup();
    break;
  case 'LEARN':
    if (!$('#quickSubmit').prop('disabled')) {
      $('#quickSubmit').click();
    }
  case 'SUB':
    highlightCurrentGroup();
    break;
  case 'VOL_UP':
    $all = $(`input[name=${GroupNames[CurrentGroup]}]`);
    $el = $(`input[name=${GroupNames[CurrentGroup]}]:checked`);
    if (!$el.length || $el.is($all.first())) {
      $el = $all.last();
    } else {
      $el = $el.prevAll(':radio:first');
    }
    $el.prop('checked', true);
    onChangeQuickConfig();
    break;
  case 'VOL_DOWN':
    $all = $(`input[name=${GroupNames[CurrentGroup]}]`);
    $el = $(`input[name=${GroupNames[CurrentGroup]}]:checked`);
    if (!$el.length || $el.is($all.last())) {
      $el = $all.first();
    } else {
      $el = $el.nextAll(':radio:first');
    }
    $el.prop('checked', true);
    onChangeQuickConfig();
    break;
  }
}

// We abstracted this out so that Ricky could easily reuse it.
function getSettings() {
  const fixture = $('input[name=fixture]:checked').val();
  const display = $('input[name=display]:checked').val();
  const player = $('input[name=player]:checked').val();
  const localeIdx = $('input[name=language]:checked').val();
  const exclusion = $('input[name=exclusion]:checked').val();
  const locale = QuickConfig.languages[localeIdx].locale;
  const settings = QuickConfig.fixtureConfigs[fixture]
                              .displayConfigs[display]
                              .playerConfigs[player];
  const type = settings.values.ExRModel.substr(0, 2);
  const sbdType = settings.values.ExRModel.slice(-2);
  const collatValues = {};
  if ((type === 'HT' && !IsSimpleDemo || sbdType === 'HT' && IsSimpleDemo) && exclusion) {
    const collat = ((settings.values.collateralDefinition || '') + ' ' + exclusion).trim();
    collatValues.collateralDefinition = collat;
  }
  const xtraValues = {};
  if (EnableRapidConfig) {
    xtraValues.RDMMode = $('#rdmOff').prop('checked') ? 'no' : 'yes';
  }
  const newSettings = Object.assign({}, QuickConfig.defaultValues,
                                    {locale: locale}, settings.values, collatValues, xtraValues);
  return { newSettings: newSettings, localeIdx: localeIdx, };
}

function normalConfig(us) {
  $('#QRCodes').show();
  $('#longConfig').show();

  let str=`<form id="vars" action="${SetValsCmd}" method="post"><table class="shell">`;

  str += '<tr><td class="shellLabel">Required:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "nagiosserver":
        desc="Nagios Address";
        break;
      case "storecontrolserver":
        desc="Dashboard Address";
        break;
      case "exrmodel":
        desc="Experience (AIO, HT, or HT+TV)";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="text" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td>&nbsp;</td></tr>';
  str += '<tr><td class="shellLabel">Optional:</td><td>(blank is default)</td></tr>';
  str += '<tr><td>&nbsp;</td></tr>';

  str += '<tr><td class="shellLabel">Experience Tuning:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "speakermodel":
        desc="Speaker Model";
        break;
      case "collateraldefinition":
        desc="Collateral";
        break;
      case "locale":
        desc="Locale (ISO 639-1, blank=en-US)";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="text" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td class="shellLabel">Site:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "unitid1":
        desc="Unit ID 1";
        break;
      case "unitid2":
        desc="Unit ID 2";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="text" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td class="shellLabel">Volumes:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "startingvolumesetting":
        desc="Starting Volume (low, medium, high, blank=default)";
        break;
      case "maxvolumesetting":
        desc="Maximum Volume (blank=default)";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="text" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td class="shellLabel">Room Equalization:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "setgainsub":
        desc="Sub Gain (-15 to +15, blank=don't change)";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="text" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td>&nbsp;</td></tr>';

  str += '<tr><td class="shellLabel">Misc:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    var fieldType = "text";
    switch (key.toLowerCase()) {
      case "rdmmode":
        desc="Retail Display Mode (yes/no)";
        break;
      case "desiredvideoresolution":
        desc="Video resolution (Careful: change only if needed)";
        break;
      case "debugprint":
        desc="Debugging control";
        break;
      case "runasdemo":
        desc="Run locally in \"no players\" demo mode (yes/no)";
        break;
      case "sessiontimeoutdefault":
        desc="Session timeout (seconds; blank=120 secs)";
        break;
      case "reresetinterval":
        desc="Automatic reset interval (minutes; blank/0 disables)";
        break;
      case "gpioport":
        desc="GPIO Port (BrightSign or Expander-0-GPIO)";
        break;
    }
    if (desc)
      str += '<tr><td class="editDesc">'+desc+'</td><td width="25px">&nbsp;</td><td><input class="bs_input" type="'+fieldType+'" name="'+key+'" value="'+htmlEscape(val)+'"/></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td>&nbsp;</td></tr>';
  str += '<tr><td class="shellLabel">Promotion:</td><td><table class="edit">';

  for (const key in us) {
    const val = us[key];
    let desc;
    switch (key.toLowerCase()) {
      case "promo":
        desc="Promotion code";
        break;
      case "promoastart":
        desc="Promotion start date (YYYY-MM-DD at midnight)";
        break;
      case "promobend":
        desc="Promotion end date (YYYY-MM-DD at midnight)";
        break;
      default:
        continue;
    }
    str += '<tr><td class="editDesc">'+desc+`</td><td width="25px">&nbsp;</td><td><div class="ui-input-text"><input class="bs_input" type="text" name="`+key+'" value="'+htmlEscape(val)+'"/></div></td></tr>';
  }
  str += '</table></td></tr>';

  str += '</table>';

  str += '<br/><br/><center>';
  str += '<button class="control" href="#" onclick="return doSubmit();">Save Values</button>&nbsp;&nbsp;&nbsp;';
  str += '<button class="control" href="#" onclick="return doReboot();">Reboot</button>';
  if (IsRunningOnBrightSign) {
    str += '&nbsp;&nbsp;&nbsp;<button class="control" href="#" onclick="return doReauth();">' +
           'Return to Authentication</button>';
  }
  str += '</center></form>';
  $('div.varform').html(str);

  str ='<table id="valuetable" >';
  for (const key in us) {
    const val = us[key];

    switch (key.toLowerCase()) {
      case "nagiosserver":
      case "storecontrolserver":
      case "exrmodel":

      case "locale":
      case "speakermodel":
      case "collateraldefinition":

      case "unitid1":
      case "unitid2":

      case "startingvolumesetting":
      case "maxvolumesetting":

      case "setgainsub":

      case "rdmmode":
      case "desiredvideoresolution":
      case "debugprint":
      case "runasdemo":
      case "sessiontimeoutdefault":
      case "reresetinterval":
      case "gpioport":

      case "promo":
      case "promoastart":
      case "promobend":

      case "accesstoken":
      case "refreshtoken":
      case "authtoken":

      break;

      default:
        str += '<tr><td>'+key+'</td><td>'+val+'</td></tr>';
        break;
    }

  }
  str += '</table>';

  $('div.vardiv').html(str);
}

function tuneConfig(us) {
//  if (Query.setup !== 'LocalTune') {
//    us.currentdt = '';
//    getTopology();
//  }

  $('#QRCodes').hide();
  $('#longConfig').hide();

  let str=`<form id="vars" action="${SetValsCmd}" method="post"><table class="shell">`;

  str += '<tr><td class="shellLabel" style="padding-top:20px">Experience Tuning:</td><td><table class="edit">';
  for (const key in us) {
    const val = us[key];
    let desc;
    let role;
    switch (key.toLowerCase()) {
      case "collateraldefinition":
        desc="Collateral";
        break;
      case "startingvolumesetting":
        desc="Starting Volume (low, medium, high, blank=default)";
        break;
      case "maxvolumesetting":
        desc="Maximum Volume (blank=default)";
        break;
      case "sessiontimeoutdefault":
        desc="Session timeout (seconds; blank=120 secs)";
        break;
      case "reresetinterval":
        desc="Automatic reset interval (minutes; blank/0 disables)";
        break;
      default:
        continue;
    }
    str += '<tr><td class="editDesc">'+desc+`</td><td width="25px">&nbsp;</td><td><div class="ui-input-text"><input class="bs_input ${role}" type="text" name="`+key+'" value="'+htmlEscape(val)+'"/></div></td></tr>';
  }
  str += '</table></td></tr>';

  str += '<tr><td>&nbsp;</td></tr>';
  str += '<tr><td class="shellLabel">Promotion:</td><td><table class="edit">';

  for (const key in us) {
    const val = us[key];
    let desc;
    let role;
    switch (key.toLowerCase()) {
      case "promo":
        desc="Promotion code";
        break;
      case "promoastart":
        desc="Promotion start date (YYYY-MM-DD at midnight)";
        role = 'calbox';
        break;
      case "promobend":
        desc="Promotion end date (YYYY-MM-DD at midnight)";
        role = 'calbox';
        break;
      case "currentdt":
        desc="Clock (<i>date</i>T<i>24-hour-time</i>, local time zone)";
        role = 'datetimebox';
        break;
      default:
        continue;
    }
    str += '<tr><td class="editDesc">'+desc+`</td><td width="25px">&nbsp;</td><td width="280px"><div class="ui-input-text"><input class="bs_input ${role}" type="text" name="`+key+'" value="'+htmlEscape(val)+'"/></div></td></tr>';
  }
  str += '</table></td></tr>';

  str += '</table>';

  str += '<br/><br/><center>';
  str += '<button class="control" href="#" onclick="return doSubmit();">' +
          'Save Values</button>&nbsp;&nbsp;&nbsp;';
  str += '<button class="control" href="#" onclick="return doReboot();">Reboot</button>';
  if (window.location.hostname === 'localhost') {
    str += '<div><br><br>';
    str += '<button class="control" href="#" onclick="return doReconfig();">' +
            'Return to Configuration</button>';
    str += '</div>';
  }
  str += '</center></form>';
  $('div.varform').html(str);

  $('.calbox').datebox({mode: "calbox", "calHighToday": false});
  $('.datetimebox').datebox({mode: "datetimebox"});
}
