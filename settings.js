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
    browser.storage.local
        .get('speechSettings')
        .then(result => {
            if (result.speechSettings) {
                // Set the slider values based on the stored speechSettings
                speedSlider.value = result.speechSettings.speechSpeed;
                volumeSlider.value = result.speechSettings.speechVolume;

                selectTTS.value = result.speechSettings.speechVoice;
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
    }

    // Function to handle volume slider change
    function handleVolumeChange(event) {
        // Perform actions with the volume value
        speechSettings.speechVolume = parseFloat(event.target.value);
        saveSpeechSettings();
    }

    // Function to handle TTS voice change
    function handleTTSvoiceChange(event) {
        // Perform actions with the volume value
        speechSettings.speechVoice = event.target.value;
        saveSpeechSettings();
    }

    // Function to save the speech settings in extension storage
    function saveSpeechSettings() {
        browser.storage.local.set({ speechSettings: speechSettings });
    }

    function fetchVoices() {
        return new Promise((resolve, reject) => {
            const speechSynthesis = window.speechSynthesis;

            // Check if voices are already available
            if (speechSynthesis.getVoices().length > 0) {
                resolve(speechSynthesis.getVoices());
            } else {
                // Wait for voices to be loaded
                speechSynthesis.onvoiceschanged = () => {
                    resolve(speechSynthesis.getVoices());
                };
            }
        });
    }

    // Function to populate the TTS engines dropdown
    function populateTTSEngines() {
        const select = document.getElementById('engineSelect');
        select.innerHTML = '';

        if ('speechSynthesis' in window) {
            fetchVoices()
                .then(voices => {
                    // Clear the existing options
                    select.innerHTML = '';

                    voices.forEach(voice => {
                        const option = document.createElement('option');
                        option.text = voice.name;
                        option.value = voice.voiceURI;
                        select.add(option);
                    });

                    // add google translate voices
                    var voices1 = [
                        { "voice_name": "GoogleTranslate Afrikaans", "lang": "af" },
                        { "voice_name": "GoogleTranslate Albanian", "lang": "sq" },
                        { "voice_name": "GoogleTranslate Arabic", "lang": "ar" },
                        { "voice_name": "GoogleTranslate Armenian", "lang": "hy" },
                        { "voice_name": "GoogleTranslate Bengali", "lang": "bn" },
                        { "voice_name": "GoogleTranslate Bosnian", "lang": "bs" },
                        { "voice_name": "GoogleTranslate Bulgarian", "lang": "bg" },
                        { "voice_name": "GoogleTranslate Catalan", "lang": "ca" },
                        { "voice_name": "GoogleTranslate Chinese", "lang": "zh-CN" },
                        { "voice_name": "GoogleTranslate Croatian", "lang": "hr" },
                        { "voice_name": "GoogleTranslate Czech", "lang": "cs" },
                        { "voice_name": "GoogleTranslate Danish", "lang": "da" },
                        { "voice_name": "GoogleTranslate Dutch", "lang": "nl" },
                        { "voice_name": "GoogleTranslate English", "lang": "en" },
                        { "voice_name": "GoogleTranslate Esperanto", "lang": "eo" },
                        { "voice_name": "GoogleTranslate Estonian", "lang": "et" },
                        { "voice_name": "GoogleTranslate Filipino", "lang": "fil" },
                        { "voice_name": "GoogleTranslate Finnish", "lang": "fi" },
                        { "voice_name": "GoogleTranslate French", "lang": "fr" },
                        { "voice_name": "GoogleTranslate German", "lang": "de" },
                        { "voice_name": "GoogleTranslate Greek", "lang": "el" },
                        { "voice_name": "GoogleTranslate Gujarati", "lang": "gu" },
                        { "voice_name": "GoogleTranslate Hebrew", "lang": "he" },
                        { "voice_name": "GoogleTranslate Hindi", "lang": "hi" },
                        { "voice_name": "GoogleTranslate Hungarian", "lang": "hu" },
                        { "voice_name": "GoogleTranslate Icelandic", "lang": "is" },
                        { "voice_name": "GoogleTranslate Indonesian", "lang": "id" },
                        { "voice_name": "GoogleTranslate Italian", "lang": "it" },
                        { "voice_name": "GoogleTranslate Japanese", "lang": "ja" },
                        { "voice_name": "GoogleTranslate Javanese", "lang": "jw" },
                        { "voice_name": "GoogleTranslate Kannada", "lang": "kn" },
                        { "voice_name": "GoogleTranslate Khmer", "lang": "km" },
                        { "voice_name": "GoogleTranslate Korean", "lang": "ko" },
                        { "voice_name": "GoogleTranslate Latin", "lang": "la" },
                        { "voice_name": "GoogleTranslate Latvian", "lang": "lv" },
                        { "voice_name": "GoogleTranslate Macedonian", "lang": "mk" },
                        { "voice_name": "GoogleTranslate Malay", "lang": "ms" },
                        { "voice_name": "GoogleTranslate Malayalam", "lang": "ml" },
                        { "voice_name": "GoogleTranslate Marathi", "lang": "mr" },
                        { "voice_name": "GoogleTranslate Myanmar (Burmese)", "lang": "my" },
                        { "voice_name": "GoogleTranslate Nepali", "lang": "ne" },
                        { "voice_name": "GoogleTranslate Norwegian", "lang": "no" },
                        { "voice_name": "GoogleTranslate Polish", "lang": "pl" },
                        { "voice_name": "GoogleTranslate Portuguese", "lang": "pt" },
                        { "voice_name": "GoogleTranslate Romanian", "lang": "ro" },
                        { "voice_name": "GoogleTranslate Russian", "lang": "ru" },
                        { "voice_name": "GoogleTranslate Serbian", "lang": "sr" },
                        { "voice_name": "GoogleTranslate Sinhala", "lang": "si" },
                        { "voice_name": "GoogleTranslate Slovak", "lang": "sk" },
                        { "voice_name": "GoogleTranslate Spanish", "lang": "es" },
                        { "voice_name": "GoogleTranslate Sundanese", "lang": "su" },
                        { "voice_name": "GoogleTranslate Swahili", "lang": "sw" },
                        { "voice_name": "GoogleTranslate Swedish", "lang": "sv" },
                        { "voice_name": "GoogleTranslate Tagalog", "lang": "tl" },
                        { "voice_name": "GoogleTranslate Tamil", "lang": "ta" },
                        { "voice_name": "GoogleTranslate Telugu", "lang": "te" },
                        { "voice_name": "GoogleTranslate Thai", "lang": "th" },
                        { "voice_name": "GoogleTranslate Turkish", "lang": "tr" },
                        { "voice_name": "GoogleTranslate Ukrainian", "lang": "uk" },
                        { "voice_name": "GoogleTranslate Urdu", "lang": "ur" },
                        { "voice_name": "GoogleTranslate Vietnamese", "lang": "vi" },
                        { "voice_name": "GoogleTranslate Welsh", "lang": "cy" }
                    ];
                    voices1.forEach(voice => {
                        const option = document.createElement('option');
                        option.text = voice.voice_name;
                        option.value = voice.lang;
                        select.add(option);
                    });

                    // Retrieve the stored speechSettings from extension storage
                    browser.storage.local.get('speechSettings', result => {
                        if (result.speechSettings && result.speechSettings.speechVoice) {
                            select.value = result.speechSettings.speechVoice;
                        }
                    });
                })
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
browser.storage.local
    .get('speechSettings')
    .then(result => {
        if (result.speechSettings) {
            speechSettings = result.speechSettings;
        } else {
            // Initialize speechSettings if it doesn't exist in storage
            speechSettings = {
                speechSpeed: 1.6,
                speechVolume: 1.0,
                speechVoice: null
            };
        }
    });