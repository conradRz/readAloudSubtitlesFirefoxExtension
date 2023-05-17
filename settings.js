

document.addEventListener('DOMContentLoaded', () => {
    let speedSlider = document.getElementById('speedSlider');
    let volumeSlider = document.getElementById('volumeSlider');

    // Add event listeners to the sliders
    speedSlider.addEventListener('input', handleSpeedChange);
    volumeSlider.addEventListener('input', handleVolumeChange);


    // Retrieve the stored speechSettings from extension storage
    browser.storage.local.get('speechSettings')
        .then(result => {
            if (result.speechSettings) {
                // Set the slider values based on the stored speechSettings
                speedSlider.value = result.speechSettings.speechSpeed;
                volumeSlider.value = result.speechSettings.speechVolume;
            }
        })
        .catch(error => {
            console.error('Error retrieving speechSettings:', error);
        });

    // Function to handle speed slider change
    function handleSpeedChange(event) {
        // Perform actions with the speed value
        console.log('Speed value:', event.target.value);
        speechSettings.speechSpeed = parseFloat(event.target.value);
        console.log('Speed value1:', speechSettings.speechSpeed);
        saveSpeechSettings();
        sendMessageToContentScript();
    }

    // Function to handle volume slider change
    function handleVolumeChange(event) {
        // Perform actions with the volume value
        console.log('Volume value:', event.target.value);
        speechSettings.speechVolume = parseFloat(event.target.value);
        console.log('Volume value1:', speechSettings.speechVolume);
        saveSpeechSettings();
        sendMessageToContentScript();
    }
    // Function to save the speech settings in extension storage
    function saveSpeechSettings() {
        browser.storage.local.set({ speechSettings: speechSettings });
    }

    // Function to send the updateSpeechSettings message to content.js
    function sendMessageToContentScript() {
        browser.tabs.query({ active: true, currentWindow: true })
            .then(tabs => {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSpeechSettings',
                    speechSettings: speechSettings
                });
            });
    }
});

// Retrieve the speech settings from extension storage on startup
browser.storage.local.get('speechSettings')
    .then(result => {
        if (result.speechSettings) {
            speechSettings = result.speechSettings;
        }
    });