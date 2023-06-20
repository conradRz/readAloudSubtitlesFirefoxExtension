
function SimpleSource(texts, opts) {
  opts = opts || {}
  this.ready = Promise.resolve({
    lang: opts.lang,
  })
  this.isWaiting = function () {
    return false;
  }
  this.getCurrentIndex = function () {
    return Promise.resolve(0);
  }
  this.getTexts = function (index) {
    return Promise.resolve(index == 0 ? texts : null);
  }
  this.close = function () {
    return Promise.resolve();
  }
  this.getUri = function () {
    var textLen = texts.reduce(function (sum, text) { return sum + text.length }, 0);
    return "text-selection:(" + textLen + ")" + encodeURIComponent((texts[0] || "").substr(0, 100));
  }
}


function TabSource(tabId) {
  var handlers = [
    // default -------------------------------------------------------------------
    {
      match: function () {
        return true;
      },
      validate: function () {
      }
    }
  ]


  var tabPromise = tabId ? getTab(tabId) : getActiveTab();
  var tab, handler, frameId, peer;
  var waiting = true;

  this.ready = tabPromise
    .then(function (res) {
      if (!res) throw new Error(JSON.stringify({ code: "error_page_unreadable" }));
      tab = res;
      handler = handlers.find(function (h) { return h.match(tab.url || "") });
      return handler.validate();
    })
    .then(function () {
      if (handler.getFrameId)
        return getAllFrames(tab.id).then(handler.getFrameId).then(function (res) { frameId = res });
    })
    .then(function () {
      if (handler.connect) return handler.connect();
      return waitForConnect()
        .then(function (port) {
          return new Promise(function (fulfill) {
            peer = new RpcPeer(new ExtensionMessagingPeer(port));
            peer.onInvoke = function (method, arg0) {
              if (method == "onReady") fulfill(arg0);
              else console.error("Unknown method", method);
            }
            peer.onDisconnect = function () {
              peer = null;
            }
          })
        })
    })
    .then(extraAction(function (info) {
      if (info.requireJs) {
        var tasks = info.requireJs.map(function (file) { return inject.bind(null, file) });
        return inSequence(tasks);
      }
    }))
    .finally(function () {
      waiting = false;
    })

  this.isWaiting = function () {
    return waiting;
  }
  this.getCurrentIndex = function () {
    if (!peer) return Promise.resolve(0);
    waiting = true;
    return peer.invoke("getCurrentIndex").finally(function () { waiting = false });
  }
  this.getTexts = function (index, quietly) {
    if (!peer) return Promise.resolve(null);
    waiting = true;
    return peer.invoke("getTexts", index, quietly)
      .then(function (res) {
        if (handler.getTexts) return handler.getTexts(tab);
        else return res;
      })
      .finally(function () { waiting = false })
  }
  this.close = function () {
    if (peer) peer.disconnect();
    return Promise.resolve();
  }
  this.getUri = function () {
    return tabPromise.then(function (tab) { return tab && tab.url });
  }

  function waitForConnect() {
    return new Promise(function (fulfill, reject) {
      function onConnect(port) {
        if (port.name == "ReadAloudContentScript") {
          browser.runtime.onConnect.removeListener(onConnect);
          clearTimeout(timer);
          fulfill(port);
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
      injectScripts().catch(onError);
      var timer = setTimeout(onTimeout, 15000);
    })
  }
  function injectScripts() {
    return inject("js/jquery-3.1.1.min.js")
      .then(inject.bind(null, "js/messaging.js"))
      .then(function () {
        if (handler.extraScripts) {
          var tasks = handler.extraScripts.map(function (file) { return inject.bind(null, file) });
          return inSequence(tasks);
        }
      })
      .then(inject.bind(null, "js/content.js"))
  }
  function inject(file) {
    var details = { file: file, tabId: tab.id };
    if (frameId) details.frameId = frameId;
    return executeScript(details);
  }
}


function Doc(source, onEnd) {
  var info;
  var currentIndex;
  var activeSpeech;
  var ready = Promise.resolve(source.getUri())
    .then(function (uri) { return setState("lastUrl", uri) })
    .then(function () { return source.ready })
    .then(function (result) { info = result })
  var foundText;

  this.close = close;
  this.play = play;
  this.stop = stop;
  this.pause = pause;
  this.getState = getState;
  this.getActiveSpeech = getActiveSpeech;

  //method close
  function close() {
    return ready
      .catch(function () { })
      .then(function () {
        if (activeSpeech) activeSpeech.stop().then(function () { activeSpeech = null });
        source.close();
      })
  }

  //method play
  function play() {
    return ready
      .then(function () {
        if (activeSpeech) return activeSpeech.play();
        else {
          return source.getCurrentIndex()
            .then(function (index) { currentIndex = index })
            .then(function () { return readCurrent() })
        }
      })
  }

  function readCurrent(rewinded) {
    return source.getTexts(currentIndex)
      .catch(function () {
        return null;
      })
      .then(function (texts) {
        if (texts) {
          if (texts.length) {
            foundText = true;
            return read(texts);
          }
          else {
            currentIndex++;
            return readCurrent();
          }
        }
        else {
          if (!foundText) throw new Error(JSON.stringify({ code: "error_no_text" }))
          if (onEnd) onEnd()
        }
      })
    function read(texts) {
      texts = texts.map(preprocess)
      return Promise.resolve()
        // .then(function () {
        //   if (info.detectedLang == null)
        //     return detectLanguage(texts)
        //       .then(function (lang) {
        //         info.detectedLang = lang || "";
        //       })
        // })
        .then(getSpeech.bind(null, texts))
        .then(function (speech) {
          if (activeSpeech) return;
          activeSpeech = speech;
          activeSpeech.onEnd = function (err) {
            if (err) {
              if (onEnd) onEnd(err);
            }
            else {
              activeSpeech = null;
              currentIndex++;
              readCurrent()
                .catch(function (err) {
                  if (onEnd) onEnd(err)
                })
            }
          };
          if (rewinded) activeSpeech.gotoEnd();
          return activeSpeech.play();
        })
    }
    function preprocess(text) {
      text = truncateRepeatedChars(text, 3)
      return text.replace(/https?:\/\/\S+/g, "HTTP URL.")
    }
  }

  async function getSpeech(texts) {
    const settings = await getSettings();
    console.log("Declared", info.lang);
    var lang = info.lang;
    console.log("Chosen", lang);

    let options = {};
    let speechSettings;

    const result = await browser.storage.local.get('speechSettings');
    if (result.speechSettings) {
      speechSettings = result.speechSettings;
      options = {
        rate: speechSettings.speechSpeed || defaults.rate,
        volume: speechSettings.speechVolume || defaults.volume,
        lang: config.langMap[lang] || lang || 'en-US',
      };
    } else {
      options = {
        rate: settings.rate || defaults.rate,
        volume: settings.volume || defaults.volume,
        lang: config.langMap[lang] || lang || 'en-US',
      };
    }

    const voice = await getSpeechVoice(settings.voiceName, options.lang);
    if (!voice) throw new Error(JSON.stringify({ code: "error_no_voice", lang: options.lang }));

    options.voice = voice;
    return new Speech(texts, options);
  }


  //method stop
  function stop() {
    return ready
      .then(function () {
        if (activeSpeech) return activeSpeech.stop().then(function () { activeSpeech = null });
      })
  }

  //method pause
  function pause() {
    return ready
      .then(function () {
        if (activeSpeech) return activeSpeech.pause();
      })
  }

  //method getState
  function getState() {
    if (activeSpeech) return activeSpeech.getState();
    else return Promise.resolve(source.isWaiting() ? "LOADING" : "STOPPED");
  }

  //method getActiveSpeech
  function getActiveSpeech() {
    return Promise.resolve(activeSpeech);
  }
}
