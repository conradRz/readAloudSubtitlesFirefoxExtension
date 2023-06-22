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
        const selectedVoiceURI = event.target.value;
        let selectedVoiceName;

        voices.forEach(voice => {
            if (voice.voiceURI === selectedVoiceURI) {
                selectedVoiceName = voice.name;
            }
        });

        if (selectedVoiceName) {
            speechSettings.speechVoice = selectedVoiceName;
            // saveSpeechSettings();

            const speechVoice = speechSettings.speechVoice;
            // Update the dropdowns in the content.js file
            browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                browser.tabs.sendMessage(tabs[0].id, { command: 'updateDropdowns', voice: speechVoice });
            });
        } else { // for GoogleTranslate voices
            speechSettings.speechVoice = event.target.value;

            const speechVoice = speechSettings.speechVoice;
            // Update the dropdowns in the content.js file
            browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                browser.tabs.sendMessage(tabs[0].id, { command: 'updateDropdowns', voice: speechVoice });
            });
        }
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
                    const voices1 = [
                        { "voice_name": "GoogleTranslate Afrikaans", "lang": "GoogleTranslate_af" },
                        { "voice_name": "GoogleTranslate Albanian", "lang": "GoogleTranslate_sq" },
                        { "voice_name": "GoogleTranslate Arabic", "lang": "GoogleTranslate_ar" },
                        { "voice_name": "GoogleTranslate Bengali", "lang": "GoogleTranslate_bn" },
                        { "voice_name": "GoogleTranslate Bosnian", "lang": "GoogleTranslate_bs" },
                        { "voice_name": "GoogleTranslate Bulgarian", "lang": "GoogleTranslate_bg" },
                        { "voice_name": "GoogleTranslate Catalan", "lang": "GoogleTranslate_ca" },
                        { "voice_name": "GoogleTranslate Chinese", "lang": "GoogleTranslate_zh-CN" },
                        { "voice_name": "GoogleTranslate Croatian", "lang": "GoogleTranslate_hr" },
                        { "voice_name": "GoogleTranslate Czech", "lang": "GoogleTranslate_cs" },
                        { "voice_name": "GoogleTranslate Danish", "lang": "GoogleTranslate_da" },
                        { "voice_name": "GoogleTranslate Dutch", "lang": "GoogleTranslate_nl" },
                        { "voice_name": "GoogleTranslate English", "lang": "GoogleTranslate_en" },
                        { "voice_name": "GoogleTranslate Estonian", "lang": "GoogleTranslate_et" },
                        { "voice_name": "GoogleTranslate Filipino", "lang": "GoogleTranslate_fil" },
                        { "voice_name": "GoogleTranslate Finnish", "lang": "GoogleTranslate_fi" },
                        { "voice_name": "GoogleTranslate French", "lang": "GoogleTranslate_fr" },
                        { "voice_name": "GoogleTranslate German", "lang": "GoogleTranslate_de" },
                        { "voice_name": "GoogleTranslate Greek", "lang": "GoogleTranslate_el" },
                        { "voice_name": "GoogleTranslate Gujarati", "lang": "GoogleTranslate_gu" },
                        { "voice_name": "GoogleTranslate Hebrew", "lang": "GoogleTranslate_he" },
                        { "voice_name": "GoogleTranslate Hindi", "lang": "GoogleTranslate_hi" },
                        { "voice_name": "GoogleTranslate Hungarian", "lang": "GoogleTranslate_hu" },
                        { "voice_name": "GoogleTranslate Icelandic", "lang": "GoogleTranslate_is" },
                        { "voice_name": "GoogleTranslate Indonesian", "lang": "GoogleTranslate_id" },
                        { "voice_name": "GoogleTranslate Italian", "lang": "GoogleTranslate_it" },
                        { "voice_name": "GoogleTranslate Japanese", "lang": "GoogleTranslate_ja" },
                        { "voice_name": "GoogleTranslate Javanese", "lang": "GoogleTranslate_jw" },
                        { "voice_name": "GoogleTranslate Kannada", "lang": "GoogleTranslate_kn" },
                        { "voice_name": "GoogleTranslate Khmer", "lang": "GoogleTranslate_km" },
                        { "voice_name": "GoogleTranslate Korean", "lang": "GoogleTranslate_ko" },
                        { "voice_name": "GoogleTranslate Latin", "lang": "GoogleTranslate_la" },
                        { "voice_name": "GoogleTranslate Latvian", "lang": "GoogleTranslate_lv" },
                        { "voice_name": "GoogleTranslate Malay", "lang": "GoogleTranslate_ms" },
                        { "voice_name": "GoogleTranslate Malayalam", "lang": "GoogleTranslate_ml" },
                        { "voice_name": "GoogleTranslate Marathi", "lang": "GoogleTranslate_mr" },
                        { "voice_name": "GoogleTranslate Myanmar (Burmese)", "lang": "GoogleTranslate_my" },
                        { "voice_name": "GoogleTranslate Nepali", "lang": "GoogleTranslate_ne" },
                        { "voice_name": "GoogleTranslate Norwegian", "lang": "GoogleTranslate_no" },
                        { "voice_name": "GoogleTranslate Polish", "lang": "GoogleTranslate_pl" },
                        { "voice_name": "GoogleTranslate Portuguese", "lang": "GoogleTranslate_pt" },
                        { "voice_name": "GoogleTranslate Romanian", "lang": "GoogleTranslate_ro" },
                        { "voice_name": "GoogleTranslate Russian", "lang": "GoogleTranslate_ru" },
                        { "voice_name": "GoogleTranslate Serbian", "lang": "GoogleTranslate_sr" },
                        { "voice_name": "GoogleTranslate Sinhala", "lang": "GoogleTranslate_si" },
                        { "voice_name": "GoogleTranslate Slovak", "lang": "GoogleTranslate_sk" },
                        { "voice_name": "GoogleTranslate Spanish", "lang": "GoogleTranslate_es" },
                        { "voice_name": "GoogleTranslate Sundanese", "lang": "GoogleTranslate_su" },
                        { "voice_name": "GoogleTranslate Swahili", "lang": "GoogleTranslate_sw" },
                        { "voice_name": "GoogleTranslate Swedish", "lang": "GoogleTranslate_sv" },
                        { "voice_name": "GoogleTranslate Tagalog", "lang": "GoogleTranslate_tl" },
                        { "voice_name": "GoogleTranslate Tamil", "lang": "GoogleTranslate_ta" },
                        { "voice_name": "GoogleTranslate Telugu", "lang": "GoogleTranslate_te" },
                        { "voice_name": "GoogleTranslate Thai", "lang": "GoogleTranslate_th" },
                        { "voice_name": "GoogleTranslate Turkish", "lang": "GoogleTranslate_tr" },
                        { "voice_name": "GoogleTranslate Ukrainian", "lang": "GoogleTranslate_uk" },
                        { "voice_name": "GoogleTranslate Urdu", "lang": "GoogleTranslate_ur" },
                        { "voice_name": "GoogleTranslate Vietnamese", "lang": "GoogleTranslate_vi" }];
                    voices1.forEach(voice => {
                        const option = document.createElement('option');
                        option.text = voice.voice_name;
                        option.value = voice.lang;
                        select.add(option);
                    });

                    // Retrieve the stored speechSettings from extension storage
                    browser.storage.local.get('speechSettings', result => {
                        if (result.speechSettings && result.speechSettings.speechVoice) {
                            const selectedVoiceName = result.speechSettings.speechVoice;
                            let selectedVoiceURI;

                            voices.forEach(voice => {
                                if (voice.name === selectedVoiceName) {
                                    selectedVoiceURI = voice.voiceURI;
                                }
                            });

                            if (selectedVoiceURI) {
                                select.value = selectedVoiceURI;
                            } else { //to handle GoogleTranslate voices
                                select.value = result.speechSettings.speechVoice;
                            }
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