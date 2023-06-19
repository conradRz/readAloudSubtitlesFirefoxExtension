polyfills();

var config = {
  serviceUrl: "https://support.readaloud.app",
  webAppUrl: "https://readaloud.app",
  entityMap: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  },
  langMap: {
    iw: 'he'
  }
}

var defaults = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0
};


/**
 * HELPERS
 */
function getQueryString() {
  return location.search ? parseQueryString(location.search) : {};
}

function parseQueryString(search) {
  if (search.charAt(0) != '?') throw new Error("Invalid argument");
  var queryString = {};
  search.substr(1).replace(/\+/g, '%20').split('&').forEach(function (tuple) {
    var tokens = tuple.split('=');
    queryString[decodeURIComponent(tokens[0])] = tokens[1] && decodeURIComponent(tokens[1]);
  })
  return queryString;
}

function parseUrl(url) {
  var parser = document.createElement("A");
  parser.href = url;
  return parser;
}


/**
 * SETTINGS
 */
function getSettings(names) {
  return new Promise(function (fulfill) {
    browser.storage.local.get(names || ["voiceName", "rate", "pitch", "volume", "languages", "preferredVoices"], fulfill);
  });
}

function updateSettings(items) {
  return new Promise(function (fulfill) {
    browser.storage.local.set(items, fulfill);
  });
}

function clearSettings(names) {
  return new Promise(function (fulfill) {
    browser.storage.local.remove(names || ["voiceName", "rate", "pitch", "volume", "languages", "preferredVoices"], fulfill);
  });
}

function getState(key) {
  return new Promise(function (fulfill) {
    browser.storage.local.get(key, function (items) {
      fulfill(items[key]);
    });
  });
}

function setState(key, value) {
  var items = {};
  items[key] = value;
  return new Promise(function (fulfill) {
    browser.storage.local.set(items, fulfill);
  });
}


/**
 * VOICES
 */
function getVoices() {
  return getSettings(["awsCreds", "gcpCreds"])
    .then(function (settings) {
      return Promise.all([
        googleTranslateTtsEngine.getVoices(),
      ])
    })
    .then(function (arr) {
      return Array.prototype.concat.apply([], arr);
    })
}

function isGoogleTranslate(voice) {
  return /^GoogleTranslate /.test(voice.voiceName);
}

function isRemoteVoice(voice) {
  return isGoogleTranslate(voice);
}

function getSpeechVoice(voiceName, lang) {
  return Promise.all([getVoices(), getSettings(["preferredVoices"])])
    .then(function (res) {
      var voices = res[0];
      var preferredVoiceByLang = res[1].preferredVoices || {};
      var voice;
      if (voiceName) voice = findVoiceByName(voices, voiceName);
      if (!voice && lang) {
        voiceName = preferredVoiceByLang[lang.split("-")[0]];
        if (voiceName) voice = findVoiceByName(voices, voiceName);
      }
      if (!voice && lang) {
        voice = findVoiceByLang(voices.filter(negate(isRemoteVoice)), lang)
          || findVoiceByLang(voices.filter(isGoogleTranslate), lang)
          || findVoiceByLang(voices, lang);
        if (voice && isRemoteVoice(voice)) voice = Object.assign({ autoSelect: true }, voice);
      }
      return voice;
    })
}

function findVoiceByName(voices, name) {
  for (var i = 0; i < voices.length; i++) if (voices[i].voiceName == name) return voices[i];
  return null;
}

function findVoiceByLang(voices, lang) {
  var speechLang = parseLang(lang);
  var match = {};
  voices.forEach(function (voice) {
    if (voice.lang) {
      var voiceLang = parseLang(voice.lang);
      if (voiceLang.lang == speechLang.lang) {
        //language matches
        if (voiceLang.rest == speechLang.rest) {
          //dialect matches, prefer female
          if (voice.gender == "female") match.first = match.first || voice;
          else match.second = match.second || voice;
        }
        else if (!voiceLang.rest) {
          //voice specifies no dialect
          match.third = match.third || voice;
        }
        else {
          //dialect mismatch, prefer en-US (if english)
          if (voiceLang.lang == 'en' && voiceLang.rest == 'us') match.fourth = match.fourth || voice;
          else match.sixth = match.sixth || voice;
        }
      }
    }
    else {
      //voice specifies no language, assume can handle any lang
      match.fifth = match.fifth || voice;
    }
  });
  return match.first || match.second || match.third || match.fourth || match.fifth || match.sixth;
}


/**
 * HELPERS
 */
function executeFile(file) {
  return new Promise(function (fulfill, reject) {
    browser.tabs.executeScript({ file: file }, function (result) {
      if (browser.runtime.lastError) reject(new Error(browser.runtime.lastError.message));
      else fulfill(result);
    });
  });
}

function executeScript(details) {
  console.log(details);
  var tabId = details.tabId;
  delete details.tabId;
  return new Promise(function (fulfill, reject) {
    browser.tabs.executeScript(tabId, details, function (result) {
      if (browser.runtime.lastError) reject(new Error(browser.runtime.lastError.message));
      else fulfill(result);
    });
  });
}

function insertCSS(file) {
  return new Promise(function (fulfill, reject) {
    browser.tabs.insertCSS({ file: file }, function (result) {
      if (browser.runtime.lastError) reject(new Error(browser.runtime.lastError.message));
      else fulfill(result);
    })
  });
}

function getActiveTab() {
  return new Promise(function (fulfill) {
    browser.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      fulfill(tabs[0]);
    })
  })
}

function getCurrentTab() {
  return new Promise(function (fulfill, reject) {
    browser.tabs.getCurrent(function (tab) {
      if (tab) fulfill(tab)
      else reject(browser.runtime.lastError || new Error("Could not get current tab"))
    })
  })
}

function getTab(tabId) {
  return new Promise(function (fulfill) {
    browser.tabs.get(tabId, fulfill)
  })
}

function setTabUrl(tabId, url) {
  return new Promise(function (fulfill) {
    browser.tabs.update(tabId, { url: url }, fulfill);
  })
}

function createTab(url, waitForLoad) {
  return new Promise(function (fulfill) {
    browser.tabs.create({ url: url }, function (tab) {
      if (!waitForLoad) fulfill(tab);
      else browser.tabs.onUpdated.addListener(onUpdated);

      function onUpdated(tabId, changeInfo) {
        if (changeInfo.status == "complete" && tabId == tab.id) {
          browser.tabs.onUpdated.removeListener(onUpdated);
          fulfill(tab);
        }
      }
    })
  })
}

function updateTab(tabId, details) {
  return new Promise(function (fulfill, reject) {
    browser.tabs.update(tabId, details, function (tab) {
      if (tab) fulfill(tab)
      else reject(browser.runtime.lastError || new Error("Could not update tab " + tabId))
    })
  })
}

function createWindow(details) {
  return new Promise(function (fulfill, reject) {
    browser.windows.create(details, function (window) {
      if (window) fulfill(window)
      else reject(browser.runtime.lastError || new Error("Could not create window"))
    })
  })
}

function updateWindow(windowId, details) {
  return new Promise(function (fulfill, reject) {
    browser.windows.update(windowId, details, function (window) {
      if (window) fulfill(window)
      else reject(browser.runtime.lastError || new Error("Could not update window " + windowId))
    })
  })
}

function getBackgroundPage() {
  return new Promise(function (fulfill) {
    browser.runtime.getBackgroundPage(fulfill);
  });
}

function negate(pred) {
  return function () {
    return !pred.apply(this, arguments);
  }
}

function spread(f, self) {
  return function (args) {
    return f.apply(self, args);
  };
}

function extraAction(action) {
  return function (data) {
    return Promise.resolve(action(data))
      .then(function () { return data })
  }
}

function inSequence(tasks) {
  return tasks.reduce(function (p, task) { return p.then(task) }, Promise.resolve());
}

function callMethod(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (obj) {
    return obj[name].apply(obj, args);
  };
}

function waitMillis(millis) {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, millis);
  });
}

function parseLang(lang) {
  var tokens = lang.toLowerCase().replace(/_/g, '-').split(/-/, 2);
  return {
    lang: tokens[0],
    rest: tokens[1]
  };
}

function assert(truthy, message) {
  if (!truthy) throw new Error(message || "Assertion failed");
}

function formatError(err) {
  var message = browser.i18n && browser.i18n.getMessage(err.code) || err.code;
  if (message) {
    message = message
      .replace(/{(\w+)}/g, function (m, p1) { return err[p1] })
      .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='#$2'>$1</a>")
  }
  return message;
}

function urlEncode(oData) {
  if (oData == null) return null;
  var parts = [];
  for (var key in oData) parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(oData[key]));
  return parts.join("&");
}

function ajaxGet(sUrl) {
  return new Promise(ajaxGetCb.bind(null, sUrl));
}

function ajaxGetCb(sUrl, fulfill, reject) {
  var opts = typeof sUrl == "string" ? { url: sUrl } : sUrl;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", opts.url, true);
  if (opts.headers) for (var name in opts.headers) xhr.setRequestHeader(name, opts.headers[name]);
  if (opts.responseType) xhr.responseType = opts.responseType;
  xhr.onreadystatechange = function () {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200) fulfill(xhr.response);
      else if (reject) {
        var err = new Error("Failed to fetch " + opts.url.substr(0, 100));
        err.xhr = xhr;
        reject(err);
      }
    }
  };
  xhr.send(null);
}

function ajaxPost(sUrl, oData, sType) {
  return new Promise(function (fulfill, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", sUrl, true);
    xhr.setRequestHeader("Content-type", sType == "json" ? "application/json" : "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function () {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        if (xhr.status == 200) fulfill(xhr.responseText);
        else reject(new Error("Failed to fetch " + sUrl.substr(0, 100)));
      }
    };
    xhr.send(sType == "json" ? JSON.stringify(oData) : urlEncode(oData));
  })
}

function objectAssign(target, varArgs) { // .length of function is 2
  'use strict';
  if (target == null) throw new TypeError('Cannot convert undefined or null to object');
  var to = Object(target);
  for (var index = 1; index < arguments.length; index++) {
    var nextSource = arguments[index];
    if (nextSource != null) { // Skip over if undefined or null
      for (var nextKey in nextSource) {
        // Avoid bugs when hasOwnProperty is shadowed
        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
          to[nextKey] = nextSource[nextKey];
        }
      }
    }
  }
  return to;
}


/**
 * POLYFILLS
 */
function polyfills() {
  if (typeof Object.assign != 'function') {
    // Must be writable: true, enumerable: false, configurable: true
    Object.defineProperty(Object, "assign", {
      value: objectAssign,
      writable: true,
      configurable: true
    });
  }

  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (search, pos) {
      return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
  }

  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search, this_len) {
      if (this_len === undefined || this_len > this.length) {
        this_len = this.length;
      }
      return this.substring(this_len - search.length, this_len) === search;
    };
  }

  if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
      value: function (searchElement, fromIndex) {
        if (this == null) throw new TypeError('"this" is null or not defined');
        var o = Object(this);
        var len = o.length >>> 0;
        if (len === 0) return false;
        var n = fromIndex | 0;
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        function sameValueZero(x, y) {
          return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
        }
        while (k < len) {
          if (sameValueZero(o[k], searchElement)) return true;
          k++;
        }
        return false;
      },
      configurable: true,
      writable: true
    });
  }

  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function (predicate) {
        if (this == null) throw new TypeError('"this" is null or not defined');
        var o = Object(this);
        var len = o.length >>> 0;
        if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
        var thisArg = arguments[1];
        var k = 0;
        while (k < len) {
          var kValue = o[k];
          if (predicate.call(thisArg, kValue, k, o)) return kValue;
          k++;
        }
        return undefined;
      },
      configurable: true,
      writable: true
    });
  }

  if (!Array.prototype.groupBy) {
    Object.defineProperty(Array.prototype, 'groupBy', {
      value: function (keySelector, valueReducer) {
        if (!valueReducer) {
          valueReducer = function (a, b) {
            if (!a) a = [];
            a.push(b);
            return a;
          }
        }
        var result = {};
        for (var i = 0; i < this.length; i++) {
          var key = keySelector(this[i]);
          if (key != null) {
            var value = valueReducer(result[key], this[i]);
            if (value !== undefined) result[key] = value;
            else delete result[key];
          }
        }
        return result;
      },
      configurable: true,
      writable: true
    })
  }

  if (!Array.prototype.flat) {
    Object.defineProperty(Array.prototype, 'flat', {
      configurable: true,
      writable: true,
      value: function () {
        var depth =
          typeof arguments[0] === 'undefined' ? 1 : Number(arguments[0]) || 0;
        var result = [];
        var forEach = result.forEach;

        var flatDeep = function (arr, depth) {
          forEach.call(arr, function (val) {
            if (depth > 0 && Array.isArray(val)) {
              flatDeep(val, depth - 1);
            } else {
              result.push(val);
            }
          });
        };

        flatDeep(this, depth);
        return result;
      },
    });
  }

  if (!Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
      configurable: true,
      writable: true,
      value: function () {
        return Array.prototype.map.apply(this, arguments).flat(1);
      },
    });
  }

  if (!Promise.prototype.finally) {
    Object.defineProperty(Promise.prototype, 'finally', {
      value: function (callback) {
        var promise = this;
        function chain() {
          return Promise.resolve(callback()).then(function () { return promise });
        }
        return promise.then(chain, chain);
      },
      configurable: true,
      writable: true
    })
  }
}

function getUniqueClientId() {
  return getSettings(["uniqueClientId"])
    .then(function (settings) {
      return settings.uniqueClientId || createId(8).then(extraAction(saveId));
    })
  function createId(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < len; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return Promise.resolve(text);
  }
  function saveId(id) {
    return updateSettings({ uniqueClientId: id });
  }
}

function hasPermissions(perms) {
  return new Promise(function (fulfill) {
    browser.permissions.contains(perms, fulfill);
  })
}

function getAuthToken(opts) {
  if (!opts) opts = {};
  return getSettings(["authToken"])
    .then(function (settings) {
      return settings.authToken || (opts.interactive ? interactiveLogin().then(extraAction(saveToken)) : null);
    })
  //Note: Cognito webAuthFlow is always interactive (if user already logged in, it shows button "Sign in as <email>" or  "Continue with Google/Facebook/etc")
  function interactiveLogin() {
    return new Promise(function (fulfill, reject) {
      if (!browser.identity || !browser.identity.launchWebAuthFlow) return fulfill(null);
      browser.identity.launchWebAuthFlow({
        interactive: true,
        url: config.webAppUrl + "/login.html?returnUrl=" + browser.identity.getRedirectURL()
      },
        function (responseUrl) {
          if (responseUrl) {
            var index = responseUrl.indexOf("?");
            var res = parseQueryString(responseUrl.substr(index));
            if (res.error) reject(new Error(res.error_description || res.error));
            else fulfill(res.token);
          }
          else {
            if (browser.runtime.lastError) reject(new Error(browser.runtime.lastError.message));
            else fulfill(null);
          }
        })
    })
  }
  function saveToken(token) {
    if (token) return updateSettings({ authToken: token });
  }
}

function getAllFrames(tabId) {
  return new Promise(function (fulfill) {
    browser.webNavigation.getAllFrames({ tabId: tabId }, fulfill);
  })
}

function getFrameTexts(tabId, frameId, scripts) {
  return new Promise(function (fulfill, reject) {
    function onConnect(port) {
      if (port.name == "ReadAloudGetTextsScript") {
        browser.runtime.onConnect.removeListener(onConnect);
        var peer = new RpcPeer(new ExtensionMessagingPeer(port));
        peer.onInvoke = function (method, arg0) {
          clearTimeout(timer);
          if (method == "onTexts") fulfill(arg0);
          else reject(new Error("Unexpected"));
        }
      }
    }
    function onError(err) {
      browser.runtime.onConnect.removeListener(onConnect);
      clearTimeout(timer);
      reject(err);
    }
    function onTimeout() {
      browser.runtime.onConnect.removeListener(onConnect);
      reject(new Error("Timeout waiting for content script to connect"));
    }
    browser.runtime.onConnect.addListener(onConnect);
    var tasks = scripts.map(function (file) {
      return executeScript.bind(null, { file: file, tabId: tabId, frameId: frameId });
    })
    inSequence(tasks).catch(onError);
    var timer = setTimeout(onTimeout, 15000);
  })
}

function promiseTimeout(millis, errorMsg, promise) {
  return new Promise(function (fulfill, reject) {
    var timedOut = false;
    var timer = setTimeout(onTimeout, millis);
    promise.then(onFulfill, onReject);

    function onFulfill(value) {
      if (timedOut) return;
      clearTimeout(timer);
      fulfill(value);
    }
    function onReject(err) {
      if (timedOut) return;
      clearTimeout(timer);
      reject(err);
    }
    function onTimeout() {
      timedOut = true;
      reject(new Error(errorMsg));
    }
  })
}

function truncateRepeatedChars(text, max) {
  var result = ""
  var startIndex = 0
  var count = 1
  for (var i = 1; i < text.length; i++) {
    if (text.charCodeAt(i) == text.charCodeAt(i - 1)) {
      count++
      if (count == max) result += text.slice(startIndex, i + 1)
    }
    else {
      if (count >= max) startIndex = i
      count = 1
    }
  }
  if (count < max) result += text.slice(startIndex)
  return result
}
