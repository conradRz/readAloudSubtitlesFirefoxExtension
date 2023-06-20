
var activeDoc;
var playbackError = null;
var silenceLoop = new Audio("sound/silence.mp3");
silenceLoop.loop = true;

/**
 * IPC handlers
 */
var handlers = {
  playText: playText,
  stop: stop,
  getPlaybackState: getPlaybackState,
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

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message) => {
  stop()
    .then(function () {
      return playText(message.info.selectionText, message.info.lang)
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
    openDoc(new SimpleSource(text.split(/(?:\r?\n){2,}/), { lang: opts }), function (err) {
      if (err) playbackError = err
    })
  }
  return activeDoc.play()
    .catch(function (err) {
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
    closeDoc();
    if (typeof onEnd == "function") onEnd(err);
  })
  silenceLoop.play();
}

function closeDoc() {
  if (activeDoc) {
    activeDoc.close();
    activeDoc = null;
  }
}
