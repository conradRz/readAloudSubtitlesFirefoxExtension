let speechSettings = {
  speechSpeed: 1.5,
  speechVolume: 1
};

let subtitlePart = '';
let newSubtitlePart = '';

let isSpeechSynthesisInProgress = false;

// This function reads out the subtitles using TTS
function readSubtitles() {
  let subtitleElement = document.querySelector(".ytp-caption-segment");

  if (!subtitleElement) {
    scheduleNextRead();
    return;
  }

  newSubtitlePart = subtitleElement.innerHTML;

  if (newSubtitlePart !== subtitlePart) {
    subtitlePart = newSubtitlePart;

    if (isSpeechSynthesisInProgress) {
      return;
    }

    isSpeechSynthesisInProgress = true;

    let utterance = new SpeechSynthesisUtterance(subtitlePart);
    utterance.rate = speechSettings.speechSpeed;
    utterance.volume = speechSettings.speechVolume;



    utterance.onend = function () {
      isSpeechSynthesisInProgress = false;
      scheduleNextRead();
    };

    speechSynthesis.speak(utterance);

  } else {
    scheduleNextRead();
  }
}

// Function to schedule the next read after a brief interval
function scheduleNextRead() {
  setTimeout(readSubtitles, 200);
}

// Listen for messages from the background script
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'readSubtitles') {
    readSubtitles();
  } else if (message.action === 'updateSpeechSettings') {
    speechSettings = message.speechSettings;
  }
});