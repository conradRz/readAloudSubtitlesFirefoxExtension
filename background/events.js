
var activeDoc;
var playbackError = null;
var silenceLoop = new Audio("sound/silence.mp3");
silenceLoop.loop = true;


hasPermissions(config.gtranslatePerms)
  .then(function (granted) {
    if (granted) authGoogleTranslate()
  })


/**
 * IPC handlers
 */
var handlers = {
  playText: playText,
  playTab: playTab,
  stop: stop,
  pause: pause,
  getPlaybackState: getPlaybackState,
  reportIssue: reportIssue,
  authWavenet: authWavenet,
  getSpeechPosition: function () {
    return getActiveSpeech()
      .then(function (speech) {
        return speech && speech.getPosition();
      })
  },
  getPlaybackError: function () {
    if (playbackError) return { message: playbackError.message }
  },
}

browser.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    var handler = handlers[request.method];
    if (handler) {
      Promise.resolve(handler.apply(null, request.args))
        .then(sendResponse)
        .catch(function (err) {
          sendResponse({ error: err.message });
        })
      return true;
    }
    else {
      sendResponse({ error: "BAD_METHOD" });
    }
  }
);


// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message) => {
  // Access the parameters sent from the content script
  // const { param1, param2 } = info.data;
  debugger;
  const selectionText = message.info.selectionText;
  const lang = message.info.lang;

  stop()
    .then(function () {
      return playText(selectionText, lang)
    })
    .catch(console.error)

});

/**
 * METHODS
 */
function playText(text, opts) {
  opts = opts || {}
  playbackError = null
  if (!activeDoc) {
    openDoc(new SimpleSource(text.split(/(?:\r?\n){2,}/), { lang: opts.lang }), function (err) {
      if (err) playbackError = err
    })
  }
  return activeDoc.play()
    .catch(function (err) {
      handleError(err);
      closeDoc();
      throw err;
    })
}

function playTab(tabId) {
  playbackError = null
  if (!activeDoc) {
    openDoc(new TabSource(tabId), function (err) {
      if (err) playbackError = err
    })
  }
  return activeDoc.play()
    .catch(function (err) {
      handleError(err);
      closeDoc();
      throw err;
    })
}

function stop() {
  if (activeDoc) {
    activeDoc.stop();
    closeDoc();
    return Promise.resolve();
  }
  else return Promise.resolve();
}

function pause() {
  if (activeDoc) return activeDoc.pause();
  else return Promise.resolve();
}

function getPlaybackState() {
  if (activeDoc) return activeDoc.getState();
  else return Promise.resolve("STOPPED");
}

function getActiveSpeech() {
  if (activeDoc) return activeDoc.getActiveSpeech();
  else return Promise.resolve(null);
}

function openDoc(source, onEnd) {
  activeDoc = new Doc(source, function (err) {
    handleError(err);
    closeDoc();
    if (typeof onEnd == "function") onEnd(err);
  })
  silenceLoop.play();
}

function closeDoc() {
  if (activeDoc) {
    activeDoc.close();
    activeDoc = null;
    silenceLoop.pause();
  }
}

function handleError(err) {
  if (err) {
    var code = /^{/.test(err.message) ? JSON.parse(err.message).code : err.message;
    if (code == "error_payment_required") clearSettings(["voiceName"]);
    reportError(err);
  }
}

function reportError(err) {
  if (err && err.stack) {
    var details = err.stack;
    if (!details.startsWith(err.name)) details = err.name + ": " + err.message + "\n" + details;
    getState("lastUrl")
      .then(function (url) { return reportIssue(url, details) })
      .catch(console.error)
  }
}

function reportIssue(url, comment) {
  var manifest = browser.runtime.getManifest();
  return getSettings()
    .then(function (settings) {
      if (url) settings.url = url;
      settings.version = manifest.version;
      settings.userAgent = navigator.userAgent;
      return ajaxPost(config.serviceUrl + "/read-aloud/report-issue", {
        url: JSON.stringify(settings),
        comment: comment
      })
    })
}

function authWavenet() {
  createTab("https://cloud.google.com/text-to-speech/#put-text-to-speech-into-action", true)
    .then(function (tab) {
      addRequestListener();
      browser.tabs.onRemoved.addListener(onTabRemoved);
      return showInstructions();

      function addRequestListener() {
        browser.webRequest.onBeforeRequest.addListener(onRequest, {
          urls: ["https://cxl-services.appspot.com/proxy*"],
          tabId: tab.id
        })
      }
      function onTabRemoved(tabId) {
        if (tabId == tab.id) {
          browser.tabs.onRemoved.removeListener(onTabRemoved);
          browser.webRequest.onBeforeRequest.removeListener(onRequest);
        }
      }
      function onRequest(details) {
        var parser = parseUrl(details.url);
        var qs = parser.search ? parseQueryString(parser.search) : {};
        if (qs.token) {
          updateSettings({ gcpToken: qs.token });
          showSuccess();
        }
      }
      function showInstructions() {
        return executeScript({
          tabId: tab.id,
          code: [
            "var elem = document.createElement('DIV')",
            "elem.id = 'ra-notice'",
            "elem.style.position = 'fixed'",
            "elem.style.top = '0'",
            "elem.style.left = '0'",
            "elem.style.right = '0'",
            "elem.style.backgroundColor = 'yellow'",
            "elem.style.padding = '20px'",
            "elem.style.fontSize = 'larger'",
            "elem.style.zIndex = 999000",
            "elem.style.textAlign = 'center'",
            "elem.innerHTML = 'Please click the blue SPEAK-IT button, then check the I-AM-NOT-A-ROBOT checkbox.'",
            "document.body.appendChild(elem)",
          ]
            .join(";\n")
        })
      }
      function showSuccess() {
        return executeScript({
          tabId: tab.id,
          code: [
            "var elem = document.getElementById('ra-notice')",
            "elem.style.backgroundColor = '#0d0'",
            "elem.innerHTML = 'Successful, you can now use Google Wavenet voices. You may close this tab.'"
          ]
            .join(";\n")
        })
      }
    })
}

function authGoogleTranslate() {
  console.info("Installing GoogleTranslate XHR hook")
  browser.webRequest.onBeforeSendHeaders.removeListener(googleTranslateXhrHook)
  browser.webRequest.onBeforeSendHeaders.addListener(googleTranslateXhrHook, {
    urls: config.gtranslatePerms.origins,
    types: ["xmlhttprequest"]
  }, [
    "blocking", "requestHeaders"
  ])
}

function googleTranslateXhrHook(details) {
  var header = details.requestHeaders.find(function (h) { return h.name == "Sec-Fetch-Site" })
  if (header && header.value == "cross-site") header.value = "none"
  return {
    requestHeaders: details.requestHeaders
  }
}

function userGestureActivate() {
  var audio = document.createElement("AUDIO");
  audio.src = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";
  audio.play();
}
