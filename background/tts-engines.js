
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
      .then(function () {
        if (isPremiumVoice(options.voice) && !options.voice.autoSelect) {
          if (!authToken) throw new Error(JSON.stringify({ code: "error_login_required" }));
          return getAccountInfo(authToken)
            .then(function (account) {
              if (!account) throw new Error(JSON.stringify({ code: "error_login_required" }));
              if (!account.balance) throw new Error(JSON.stringify({ code: "error_payment_required" }));
            })
        }
      })
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
    { "voice_name": "Amazon Australian English (Nicole)", "lang": "en-AU", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Australian English (Russell)", "lang": "en-AU", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Brazilian Portuguese (Ricardo)", "lang": "pt-BR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Brazilian Portuguese (Vitoria)", "lang": "pt-BR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon British English (Amy)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon British English (Brian)", "lang": "en-GB", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon British English (Emma)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Canadian French (Chantal)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Castilian Spanish (Conchita)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Castilian Spanish (Enrique)", "lang": "es-ES", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Danish (Mads)", "lang": "da-DK", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Danish (Naja)", "lang": "da-DK", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Dutch (Lotte)", "lang": "nl-NL", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Dutch (Ruben)", "lang": "nl-NL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon French (Celine)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon French (Mathieu)", "lang": "fr-FR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon German (Hans)", "lang": "de-DE", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon German (Marlene)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Icelandic (Dora)", "lang": "is-IS", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Icelandic (Karl)", "lang": "is-IS", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Indian English (Raveena)", "lang": "en-IN", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Italian (Carla)", "lang": "it-IT", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Italian (Giorgio)", "lang": "it-IT", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Norwegian (Liv)", "lang": "nb-NO", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Polish (Ewa)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Polish (Jacek)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Polish (Jan)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Polish (Maja)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Portuguese (Cristiano)", "lang": "pt-PT", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Portuguese (Ines)", "lang": "pt-PT", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Romanian (Carmen)", "lang": "ro-RO", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Russian (Maxim)", "lang": "ru-RU", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Russian (Tatyana)", "lang": "ru-RU", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Swedish (Astrid)", "lang": "sv-SE", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Turkish (Filiz)", "lang": "tr-TR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Ivy)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Joey)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Justin)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Kendra)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Kimberly)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US English (Salli)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US Spanish (Miguel)", "lang": "es-US", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon US Spanish (Penelope)", "lang": "es-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Welsh (Gwyneth)", "lang": "cy-GB", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Amazon Welsh English (Geraint)", "lang": "en-GB-WLS", "gender": "male", "event_types": ["start", "end", "error"] },

    { "voice_name": "Microsoft Australian English (Catherine)", "lang": "en-AU", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Australian English (James)", "lang": "en-AU", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Austrian German (Michael)", "lang": "de-AT", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Belgian Dutch (Bart)", "lang": "nl-BE", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Brazilian Portuguese (Daniel)", "lang": "pt-BR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Brazilian Portuguese (Maria)", "lang": "pt-BR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft British English (George)", "lang": "en-GB", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft British English (Hazel)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft British English (Susan)", "lang": "en-GB", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Bulgarian (Ivan)", "lang": "bg-BG", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Canadian English (Linda)", "lang": "en-CA", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Canadian English (Richard)", "lang": "en-CA", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Canadian French (Caroline)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Canadian French (Claude)", "lang": "fr-CA", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Canadian French (Nathalie)", "lang": "fr-CA", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Catalan (Herena)", "lang": "ca-ES", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Chinese (Huihui)", "lang": "zh-CN", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Chinese (Kangkang)", "lang": "zh-CN", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Chinese (Yaoyao)", "lang": "zh-CN", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft ChineseHK (Danny)", "lang": "zh-HK", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft ChineseHK (Tracy)", "lang": "zh-HK", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Croatian (Matej)", "lang": "hr-HR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Czech (Jakub)", "lang": "cs-CZ", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Danish (Helle)", "lang": "da-DK", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Dutch (Frank)", "lang": "nl-NL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Egyptian Arabic (Hoda)", "lang": "ar-EG", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Finnish (Heidi)", "lang": "fi-FI", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft French (Hortense)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft French (Julie)", "lang": "fr-FR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft French (Paul)", "lang": "fr-FR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft German (Hedda)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft German (Katja)", "lang": "de-DE", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft German (Stefan)", "lang": "de-DE", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Greek (Stefanos)", "lang": "el-GR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Hebrew (Asaf)", "lang": "he-IL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Hindi (Hemant)", "lang": "hi-IN", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Hindi (Kalpana)", "lang": "hi-IN", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Hungarian (Szabolcs)", "lang": "hu-HU", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Indian English (Heera)", "lang": "en-IN", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Indian English (Ravi)", "lang": "en-IN", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Indonesian (Andika)", "lang": "id-ID", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Irish English (Sean)", "lang": "en-IE", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Italian (Cosimo)", "lang": "it-IT", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Italian (Elsa)", "lang": "it-IT", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Japanese (Ayumi)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Japanese (Haruka)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Japanese (Ichiro)", "lang": "ja-JP", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Japanese (Sayaka)", "lang": "ja-JP", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Korean (Heami)", "lang": "ko-KR", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Malay (Rizwan)", "lang": "ms-MY", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Mexican Spanish (Raul)", "lang": "es-MX", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Mexican Spanish (Sabina)", "lang": "es-MX", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Norwegian (Jon)", "lang": "nb-NO", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Polish (Adam)", "lang": "pl-PL", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Polish (Paulina)", "lang": "pl-PL", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Portuguese (Helia)", "lang": "pt-PT", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Romanian (Andrei)", "lang": "ro-RO", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Russian (Irina)", "lang": "ru-RU", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Russian (Pavel)", "lang": "ru-RU", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Saudi Arabic (Naayf)", "lang": "ar-SA", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Slovak (Filip)", "lang": "sk-SK", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Slovenian (Lado)", "lang": "sl-SI", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Spanish (Helena)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Spanish (Laura)", "lang": "es-ES", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Spanish (Pablo)", "lang": "es-ES", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Swedish (Bengt)", "lang": "sv-SE", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Swiss French (Guillaume)", "lang": "fr-CH", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Swiss German (Karsten)", "lang": "de-CH", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Tamil (Valluvar)", "lang": "ta-IN", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Thai (Pattara)", "lang": "th-TH", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Turkish (Tolga)", "lang": "tr-TR", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft US English (David)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft US English (Mark)", "lang": "en-US", "gender": "male", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft US English (Zira)", "lang": "en-US", "gender": "female", "event_types": ["start", "end", "error"] },
    { "voice_name": "Microsoft Vietnamese (An)", "lang": "vi-VI", "gender": "male", "event_types": ["start", "end", "error"] },
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
  var voices = [
    { "voice_name": "GoogleTranslate Afrikaans", "lang": "af", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Albanian", "lang": "sq", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Arabic", "lang": "ar", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Armenian", "lang": "hy", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Bengali", "lang": "bn", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Bosnian", "lang": "bs", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Bulgarian", "lang": "bg", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Catalan", "lang": "ca", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Chinese", "lang": "zh-CN", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Croatian", "lang": "hr", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Czech", "lang": "cs", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Danish", "lang": "da", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Dutch", "lang": "nl", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate English", "lang": "en", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Esperanto", "lang": "eo", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Estonian", "lang": "et", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Filipino", "lang": "fil", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Finnish", "lang": "fi", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate French", "lang": "fr", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate German", "lang": "de", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Greek", "lang": "el", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Gujarati", "lang": "gu", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Hebrew", "lang": "he", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Hindi", "lang": "hi", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Hungarian", "lang": "hu", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Icelandic", "lang": "is", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Indonesian", "lang": "id", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Italian", "lang": "it", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Japanese", "lang": "ja", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Javanese", "lang": "jw", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Kannada", "lang": "kn", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Khmer", "lang": "km", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Korean", "lang": "ko", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Latin", "lang": "la", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Latvian", "lang": "lv", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Macedonian", "lang": "mk", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Malay", "lang": "ms", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Malayalam", "lang": "ml", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Marathi", "lang": "mr", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Myanmar (Burmese)", "lang": "my", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Nepali", "lang": "ne", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Norwegian", "lang": "no", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Polish", "lang": "pl", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Portuguese", "lang": "pt", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Romanian", "lang": "ro", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Russian", "lang": "ru", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Serbian", "lang": "sr", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Sinhala", "lang": "si", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Slovak", "lang": "sk", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Spanish", "lang": "es", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Sundanese", "lang": "su", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Swahili", "lang": "sw", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Swedish", "lang": "sv", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Tagalog", "lang": "tl", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Tamil", "lang": "ta", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Telugu", "lang": "te", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Thai", "lang": "th", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Turkish", "lang": "tr", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Ukrainian", "lang": "uk", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Urdu", "lang": "ur", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Vietnamese", "lang": "vi", "event_types": ["start", "end", "error"] },
    { "voice_name": "GoogleTranslate Welsh", "lang": "cy", "event_types": ["start", "end", "error"] }
  ]
    .map(function (item) {
      return { voiceName: item.voice_name, lang: item.lang };
    })
}
