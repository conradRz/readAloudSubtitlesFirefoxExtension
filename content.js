// This function reads out the subtitles using TTS
function readSubtitles() {
  let subtitlePart = document.querySelector(".ytp-caption-segment");

  // If no subtitle nodes were found, show an error message and return
  if (!subtitlePart) {
    alert('No subtitles found!');
    return;
  }

  // If the subtitle text is not empty, use the built-in TTS engine to read it out
  if (subtitlePart.innerHTML !== '') {
    let utterance = new SpeechSynthesisUtterance(subtitlePart.innerHTML);
    utterance.rate = 1.5

    // Set an event handler for when the TTS engine finishes speaking the subtitle
    utterance.onend = function () {
      // Set a timeout function to check if the subtitle has changed after 500 milliseconds
      setTimeout(function checkSubtitle() {
        // Check if a new subtitle element exists and if its text is different from the current subtitle
        let newSubtitlePart = document.querySelector(".ytp-caption-segment");
        if (newSubtitlePart && newSubtitlePart.innerHTML !== subtitlePart.innerHTML) {
          // If a new subtitle exists and its text is different, update the current subtitle and read it out recursively
          subtitlePart = newSubtitlePart;
          readSubtitles();
        } else {
          // If the subtitle has not changed, wait another x milliseconds before checking again
          setTimeout(checkSubtitle, 300);
        }
      }, 300); // wait for x milliseconds before checking if subtitle has changed
    };

    speechSynthesis.speak(utterance);
  }
}


// Listen for messages from the background script
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'readSubtitles') {
    readSubtitles();
  }
});
