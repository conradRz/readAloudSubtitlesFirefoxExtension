
var browserTtsEngine = browser.tts ? new BrowserTtsEngine() : (typeof speechSynthesis != 'undefined' ? new WebSpeechEngine() : new DummyTtsEngine());
var remoteTtsEngine = new RemoteTtsEngine(config.serviceUrl);
var googleTranslateTtsEngine = new GoogleTranslateTtsEngine();

/*
interface Options {
  voice: {
    voiceName: string
    autoSelect?: boolean
  }
  lang: string
  rate?: number
  pitch?: number
  volume?: number
}

interface Event {
  type: string
}

interface Voice {
  voiceName: string
  lang: string
}

interface TtsEngine {
  speak: function(text: string, opts: Options, onEvent: (e:Event) => void): void
  stop: function(): void
  pause: function(): void
  resume: function(): void
  isSpeaking: function(callback): void
  getVoices: function(): Voice[]
}
*/

function BrowserTtsEngine() {
  this.speak = function (text, options, onEvent) {
    browser.tts.speak(text, {
      voiceName: options.voice.voiceName,
      lang: options.lang,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      requiredEventTypes: ["start", "end"],
      desiredEventTypes: ["start", "end", "error"],
      onEvent: onEvent
    })
  }
  this.stop = browser.tts.stop;
  this.pause = browser.tts.pause;
  this.resume = browser.tts.resume;
  this.isSpeaking = browser.tts.isSpeaking;
  this.getVoices = function () {
    return new Promise(function (fulfill) {
      browser.tts.getVoices(function (voices) {
        fulfill(voices || []);
      })
    })
  }
}


function WebSpeechEngine() {
  var utter;
  this.speak = function (text, options, onEvent) {
    utter = new SpeechSynthesisUtterance();
    utter.text = text;
    utter.voice = options.voice;
    if (options.lang) utter.lang = options.lang;
    if (options.pitch) utter.pitch = options.pitch;
    if (options.rate) utter.rate = options.rate;
    if (options.volume) utter.volume = options.volume;
    utter.onstart = onEvent.bind(null, { type: 'start', charIndex: 0 });
    utter.onend = onEvent.bind(null, { type: 'end', charIndex: text.length });
    utter.onerror = function (event) {
      onEvent({ type: 'error', errorMessage: event.error });
    };
    speechSynthesis.speak(utter);
  }
  this.stop = function () {
    if (utter) utter.onend = null;
    speechSynthesis.cancel();
  }
  this.pause = function () {
    speechSynthesis.pause();
  }
  this.resume = function () {
    speechSynthesis.resume();
  }
  this.isSpeaking = function (callback) {
    callback(speechSynthesis.speaking);
  }
  this.getVoices = function () {
    return promiseTimeout(1500, "Timeout WebSpeech getVoices", new Promise(function (fulfill) {
      var voices = speechSynthesis.getVoices() || [];
      if (voices.length) fulfill(voices);
      else speechSynthesis.onvoiceschanged = function () {
        fulfill(speechSynthesis.getVoices() || []);
      }
    }))
      .then(function (voices) {
        for (var i = 0; i < voices.length; i++) voices[i].voiceName = voices[i].name;
        return voices;
      })
      .catch(function (err) {
        console.error(err);
        return [];
      })
  }
}


function DummyTtsEngine() {
  this.getVoices = function () {
    return Promise.resolve([]);
  }
}


function TimeoutTtsEngine(baseEngine, timeoutMillis) {
  var timer;
  this.speak = function (text, options, onEvent) {
    var started = false;
    clearTimeout(timer);
    timer = setTimeout(function () {
      baseEngine.stop();
      if (started) onEvent({ type: "end", charIndex: text.length });
      else onEvent({ type: "error", errorMessage: "Timeout, TTS never started, try picking another voice?" });
    },
      timeoutMillis);
    baseEngine.speak(text, options, function (event) {
      if (event.type == "start") started = true;
      if (event.type == "end" || event.type == "error") clearTimeout(timer);
      onEvent(event);
    })
  }
  this.stop = function () {
    clearTimeout(timer);
    baseEngine.stop();
  }
  this.isSpeaking = baseEngine.isSpeaking;
}


function RemoteTtsEngine(serviceUrl) {
  var manifest = browser.runtime.getManifest();
  var iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
  var audio = document.createElement("AUDIO");
  var isSpeaking = false;
  var nextStartTime = 0;
  var waitTimer;
  var authToken;
  var clientId;
  var speakPromise;
  function ready(options) {
    return getAuthToken()
      .then(function (token) { authToken = token })
      .then(getUniqueClientId)
      .then(function (id) { clientId = id })
  }
  this.speak = function (utterance, options, onEvent) {
    if (!options.volume) options.volume = 1;
    if (!options.rate) options.rate = 1;
    audio.pause();
    if (!iOS) {
      audio.volume = options.volume;
      audio.defaultPlaybackRate = options.rate;
    }
    speakPromise = ready(options)
      .then(function () {
        audio.src = getAudioUrl(utterance, options.lang, options.voice);
        return new Promise(function (fulfill) { audio.oncanplay = fulfill });
      })
      .then(function () {
        var waitTime = nextStartTime - Date.now();
        if (waitTime > 0) return new Promise(function (f) { waitTimer = setTimeout(f, waitTime) });
      })
      .then(function () {
        isSpeaking = true;
        return audio.play();
      })
      .catch(function (err) {
        onEvent({
          type: "error",
          errorMessage: err.name == "NotAllowedError" ? JSON.stringify({ code: "error_user_gesture_required" }) : err.message
        })
      })
    audio.onplay = onEvent.bind(null, { type: 'start', charIndex: 0 });
    audio.onended = function () {
      onEvent({ type: 'end', charIndex: utterance.length });
      isSpeaking = false;
    };
    audio.onerror = function () {
      onEvent({ type: "error", errorMessage: audio.error.message });
      isSpeaking = false;
    };
    audio.load();
  }
  this.isSpeaking = function (callback) {
    callback(isSpeaking);
  }
  this.pause =
    this.stop = function () {
      speakPromise.then(function () {
        clearTimeout(waitTimer);
        audio.pause();
      })
    }
  this.resume = function () {
    audio.play();
  }
  this.prefetch = function (utterance, options) {
    if (!iOS) {
      ajaxGet(getAudioUrl(utterance, options.lang, options.voice, true));
    }
  }
  this.setNextStartTime = function (time, options) {
    if (!iOS)
      nextStartTime = time || 0;
  }
  this.getVoices = function () {
    return voices;
  }
  function getAudioUrl(utterance, lang, voice, prefetch) {
    assert(utterance && lang && voice);
    return serviceUrl + "/read-aloud/speak/" + lang + "/" + encodeURIComponent(voice.voiceName) + "?c=" + encodeURIComponent(clientId) + "&t=" + encodeURIComponent(authToken) + (voice.autoSelect ? '&a=1' : '') + "&v=" + manifest.version + "&pf=" + (prefetch ? 1 : 0) + "&q=" + encodeURIComponent(utterance);
  }
  var voices = [
    {},
  ]
    .map(function (item) {
      return { voiceName: item.voice_name, lang: item.lang };
    })
    .concat(
      { voiceName: "ReadAloud Generic Voice", autoSelect: true },
    )
}


function GoogleTranslateTtsEngine() {
  var audio = document.createElement("AUDIO");
  var prefetchAudio;
  var isSpeaking = false;
  var speakPromise;
  this.ready = function () {
    return hasPermissions(config.gtranslatePerms)
      .then(function (granted) {
        if (!granted) throw new Error(JSON.stringify({ code: "error_gtranslate_auth_required" }))
      })
      .then(googleTranslateReady)
  };
  this.speak = function (utterance, options, onEvent) {
    if (!options.volume) options.volume = 1;
    if (!options.rate) options.rate = 1;
    audio.pause();
    audio.volume = options.volume;
    audio.defaultPlaybackRate = options.rate * 1.1;
    audio.onplay = function () {
      onEvent({ type: 'start', charIndex: 0 });
      isSpeaking = true;
    };
    audio.onended = function () {
      onEvent({ type: 'end', charIndex: utterance.length });
      isSpeaking = false;
    };
    audio.onerror = function () {
      onEvent({ type: "error", errorMessage: audio.error.message });
      isSpeaking = false;
    };
    speakPromise = Promise.resolve()
      .then(function () {
        if (prefetchAudio && prefetchAudio[0] == utterance && prefetchAudio[1] == options) return prefetchAudio[2];
        else return getAudioUrl(utterance, options.voice.lang);
      })
      .then(function (url) {
        audio.src = url;
        return audio.play();
      })
      .catch(function (err) {
        onEvent({
          type: "error",
          errorMessage: err.name == "NotAllowedError" ? JSON.stringify({ code: "error_user_gesture_required" }) : err.message
        })
      })
  };
  this.isSpeaking = function (callback) {
    callback(isSpeaking);
  };
  this.pause =
    this.stop = function () {
      speakPromise.then(function () { audio.pause() });
    };
  this.resume = function () {
    audio.play();
  };
  this.prefetch = function (utterance, options) {
    getAudioUrl(utterance, options.voice.lang)
      .then(function (url) {
        prefetchAudio = [utterance, options, url];
      })
      .catch(console.error)
  };
  this.setNextStartTime = function () {
  };
  this.getVoices = function () {
    return voices;
  }
  function getAudioUrl(text, lang) {
    assert(text && lang);
    return googleTranslateSynthesizeSpeech(text, lang);
  }
  var voices = []
    .map(function (item) {
      return { voiceName: item.voice_name, lang: item.lang };
    })
}
