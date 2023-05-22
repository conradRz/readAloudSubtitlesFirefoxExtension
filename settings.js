document.addEventListener('DOMContentLoaded', () => {
    let speedSlider = document.getElementById('speedSlider');
    let volumeSlider = document.getElementById('volumeSlider');
    let selectTTS = document.getElementById('engineSelect');

    // Add event listeners to the sliders
    speedSlider.addEventListener('input', handleSpeedChange);
    volumeSlider.addEventListener('input', handleVolumeChange);

    // Add event listener to the TTS engine change
    selectTTS.addEventListener('change', handleTTSvoiceChange);

    // Retrieve the stored speechSettings from extension storage
    browser.storage.local.get('speechSettings')
        .then(result => {
            if (result.speechSettings) {
                // Set the slider values based on the stored speechSettings
                speedSlider.value = result.speechSettings.speechSpeed;
                volumeSlider.value = result.speechSettings.speechVolume;
                // 
                selectTTS.value = result.speechSettings.speechVoice
            }
        })
        .catch(error => {
            console.error('Error retrieving speechSettings:', error);
        });

    // Function to handle speed slider change
    function handleSpeedChange(event) {
        // Perform actions with the speed value
        speechSettings.speechSpeed = parseFloat(event.target.value);
        saveSpeechSettings();
        sendMessageToContentScript();
    }

    // Function to handle volume slider change
    function handleVolumeChange(event) {
        // Perform actions with the volume value
        speechSettings.speechVolume = parseFloat(event.target.value);
        saveSpeechSettings();
        sendMessageToContentScript();
    }

    // Function to handle TTS voice change
    function handleTTSvoiceChange(event) {
        // Perform actions with the volume value
        speechSettings.speechVoice = event.target.value;
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

    // Function to populate the TTS engines dropdown
    function populateTTSEngines() {
        const select = document.getElementById('engineSelect');
        select.innerHTML = '';

        if ('speechSynthesis' in window) {
            const synth = window.speechSynthesis;
            const voices = synth.getVoices();

            voices.forEach(voice => {
                const option = document.createElement('option');
                option.text = voice.name;
                option.value = voice.voiceURI;
                select.add(option);
            });
        } else {
            const option = document.createElement('option');
            option.text = 'TTS not supported';
            option.disabled = true;
            select.add(option);
        }
    }

    // Call the function to populate the TTS engines dropdown
    populateTTSEngines();
});

// Retrieve the speech settings from extension storage on startup
browser.storage.local.get('speechSettings')
    .then(result => {
        if (result.speechSettings) {
            speechSettings = result.speechSettings;
        }
    });