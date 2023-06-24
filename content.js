// IDs of the containers
const CONTAINER_ID = 'captionDownloadContainer'
const CONTAINER_ID2 = 'captionDownloadContainer2'

// Location to add your HTML
let insertPosition

/**
 * Download subtitle files.
 * @param {Object} track subtitle object
 */
const downloadCaptionFile = async track => {
  const url = track.baseUrl
  const xml = await fetch(url).then(resp => resp.text())
  const content = convertFromTimedToSrtFormat(xml)
  const fileName = document.title.replace(/ - YouTube/gi, '') + '.' + track.languageCode + '.srt'
  saveTextAsFile(content, fileName)
}

let intervalId; // Variable to store the interval ID
let speechSettings;

browser.storage.local.get('speechSettings')
  .then(result => {
    if (result.speechSettings) {
      speechSettings = result.speechSettings;
    } else {
      speechSettings = {
        speechSpeed: 1.6,
        speechVolume: 1,
        speechVoice: null,
        rememberUserLastSelectedAutoTranslateToLanguageCode: null
      };
      browser.storage.local.set({ speechSettings: speechSettings });
    }
  })
  .catch(error => {
    //this will not fire when there is no such thing in storage; tested
    console.error('Error retrieving speech settings:', error);
  });

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'speechSettings' in changes) {
    // Reasign the updated speechSettings array value
    speechSettings = changes.speechSettings.newValue;
  }
});

let voices;

const getVoicesWithRetry = (retryCount, interval) => {
  voices = window.speechSynthesis.getVoices();

  if (voices && voices.length > 0) {
    return;
  }

  if (retryCount <= 0) {
    console.log('Unable to retrieve voices.');
    return;
  }

  setTimeout(() => {
    getVoicesWithRetry(retryCount - 1, interval);
  }, interval);
}

const retryCount = 5;
const retryInterval = 250;

getVoicesWithRetry(retryCount, retryInterval);


const binarySearch = (textElements, currentTime) => {
  let start = 0;
  let end = textElements.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const el = textElements[mid];
    const nextEl = textElements[mid + 1];
    const elStart = parseFloat(el.getAttribute('start'));
    const nextElStart = parseFloat(nextEl.getAttribute('start'));

    if (currentTime >= elStart && currentTime <= nextElStart) {
      return el;
    } else if (currentTime < elStart) {
      end = mid - 1;
    } else {
      start = mid + 1;
    }
  }

  return null;
}

// Function to extract a parameter value from a URL
const getParameterByName = (name, url) => {
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const assignUrl = (track, selectedLanguageCode) => {
  // Extract the current language code from the track.baseUrl
  const urlLanguageCode = getParameterByName('lang', track.baseUrl);

  if (selectedLanguageCode && urlLanguageCode === selectedLanguageCode) {
    return track.baseUrl;
  }
  // The selectedLanguageCode does not contain the ":" character, which would never be a language code, but an EN or translated version of "Auto translate to:"
  else if (selectedLanguageCode && selectedLanguageCode.indexOf(":") === -1) {
    // Code for handling selected language code
    return track.baseUrl + '&tlang=' + selectedLanguageCode;
  } else {
    // Code for handling the default case
    return track.baseUrl;
  }
}

const selectCaptionFileForTTS = async (track, selectedLanguageCode = null) => {

  const url = assignUrl(track, selectedLanguageCode)
  const xml = await fetch(url).then(resp => resp.text());

  if (xml) {
    const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
    const textElements = xmlDoc.getElementsByTagName('text');

    let isSpeechSynthesisInProgress = false;
    let subtitlePart = '';
    let previousTime = NaN;

    const matchXmlTextToCurrentTime = () => {
      // save resources if the previous subtitle is being spoken. Trying to control the flow by clearInterval would not be a good idea, due to other parts of code also setting the interval; for a reason - tested; better to just return;
      if (isSpeechSynthesisInProgress) return;

      const currentTime = document.getElementsByClassName('video-stream')[0].currentTime + 0.25;

      //this will save computing cycles of iterating over an array when a video is on pause
      if (previousTime === currentTime) return;

      const matchedElement = binarySearch(textElements, currentTime);

      if (matchedElement) {
        const matchedText = matchedElement.textContent.trim();
        if (matchedText !== subtitlePart) {
          subtitlePart = matchedText;

          isSpeechSynthesisInProgress = true;

          let utterance = new SpeechSynthesisUtterance(unescapeHTML(matchedText.replace(/\n/g, "").replace(/\\"/g, '"').trim().replace(/[,\.]+$/, '').replace(/\r/g, "")));

          if (speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode !== null) {
            if (speechSettings.speechVoice && speechSettings.speechVoice.startsWith("GoogleTranslate_")) {
              const langCode = speechSettings.speechVoice.replace("GoogleTranslate_", "");
              if (langCode === speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode) {
                // Speak with GoogleTranslate_ if language codes match
                speakWithGoogleVoice(langCode);
              } else {
                const localVoice = findLocalVoice(speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode);
                if (localVoice) {
                  utterance.voice = localVoice;
                  updateSettingsAndSpeak(localVoice);
                } else {
                  speakWithGoogleVoice(speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode);
                }
              }
            } else if (!speechSettings.speechVoice) {
              // default state just after installation, and when the user didn't yet select a voice from a dropdown
              const langCode = speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode;

              const localVoice = findLocalVoice(langCode);
              if (localVoice) {
                updateSettingsAndSpeak(localVoice);
              } else {
                speakWithGoogleVoice(langCode);
              }
            } else {
              const voice = findVoiceByVoiceURI(speechSettings.speechVoice);
              if (voice && voice.lang.substring(0, 2) === speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode) {
                utterance.voice = voice;
                updateSettingsAndSpeak(voice);
              } else {
                const localVoice = findLocalVoice(speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode);
                if (localVoice) {
                  utterance.voice = localVoice;
                  updateSettingsAndSpeak(localVoice);
                } else {
                  speakWithGoogleVoice(speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode);
                }
              }
            }
          } else {
            if (speechSettings.speechVoice !== null) {
              if (speechSettings.speechVoice.startsWith("GoogleTranslate_")) {
                const langCode = speechSettings.speechVoice.replace("GoogleTranslate_", "");
                speakWithGoogleVoice(langCode);
              } else {
                const voice = findVoiceByVoiceURI(speechSettings.speechVoice);
                if (voice) {
                  utterance.voice = voice;
                  updateSettingsAndSpeak(voice);
                }
              }
            }
          }

          function speakWithGoogleVoice(langCode) {
            const message = {
              info: {
                selectionText: utterance.text,
                lang: langCode
              }
            };
            browser.runtime.sendMessage(message);
            speechSettings.speechVoice = "GoogleTranslate_" + langCode;
            browser.storage.local.set({ speechSettings: speechSettings });
            isSpeechSynthesisInProgress = false;
          }

          function findLocalVoice(langCode) {
            //cannot be just === langCode due to some codes being more than 2 chars
            return voices.find((voice) => voice.lang.substring(0, 2) === langCode.substring(0, 2));
          }

          function findVoiceByVoiceURI(voiceURI) {
            return voices.find((voice) => voice.voiceURI === voiceURI);
          }

          function updateSettingsAndSpeak(voice) {
            if (voice) {
              utterance.voice = voice;
            }

            utterance.rate = speechSettings.speechSpeed;
            utterance.volume = speechSettings.speechVolume;

            speechSettings.speechVoice = voice.voiceURI;
            browser.storage.local.set({ speechSettings: speechSettings });

            utterance.onend = () => {
              isSpeechSynthesisInProgress = false;
            };
            speechSynthesis.speak(utterance);
          }
        }
      }
      previousTime = currentTime;
    }

    clearInterval(intervalId); // Clear previous interval if exists. In order to update the interval, you need to clear the previous interval using clearInterval before setting the new interval. Simply overriding the intervalId variable without clearing the previous interval can lead to multiple intervals running simultaneously, which is likely not the desired behavior.
    intervalId = setInterval(matchXmlTextToCurrentTime, 500); // Set the new interval
  }
};


/**
 * Displays a list of subtitles that the video has.
 * @param {Array} captionTracks Subtitles array.
 */
const buildGui = captionTracks => {
  const languageTexts = {
    en: {
      subtitleFileDownload: 'Subtitle file download: ',
      selectSpeechSubtitles: 'Select speech subtitles to play alongside the video: ',
      AutoTranslateTo: 'Auto translate to:'
    },
    fr: {
      subtitleFileDownload: 'Téléchargement du fichier de sous-titres : ',
      selectSpeechSubtitles: 'Sélectionnez les sous-titres audio à lire avec la vidéo : ',
      AutoTranslateTo: 'Traduire automatiquement vers:'
    },
    ua: {
      subtitleFileDownload: 'Завантажити файл субтитрів: ',
      selectSpeechSubtitles: 'Виберіть мову субтитрів для відтворення поряд із відео: ',
      AutoTranslateTo: 'Автоматичний переклад на:'
    },
    ru: {
      subtitleFileDownload: 'Скачать файл субтитров: ',
      selectSpeechSubtitles: 'Выберите речевые субтитры для воспроизведения вместе с видео: ',
      AutoTranslateTo: 'Автоматический перевод на:'
    },
    tr: {
      subtitleFileDownload: 'Altyazı dosyasını indir: ',
      selectSpeechSubtitles: 'Videonun yanında oynatılacak konuşma altyazısını seçin: ',
      AutoTranslateTo: 'Şu dile otomatik çevir:'
    },
    it: {
      subtitleFileDownload: 'Download file dei sottotitoli: ',
      selectSpeechSubtitles: 'Seleziona i sottotitoli audio da riprodurre insieme al video: ',
      AutoTranslateTo: 'Traduzione automatica in:'
    },
    ko: {
      subtitleFileDownload: '자막 파일 다운로드: ',
      selectSpeechSubtitles: '비디오와 함께 재생할 음성 자막을 선택하세요: ',
      AutoTranslateTo: '다음으로 자동 번역:'
    },
    pl: {
      subtitleFileDownload: 'Pobierz plik napisów: ',
      selectSpeechSubtitles: 'Wybierz napisy mowy do odtwarzania podczas wideo: ',
      AutoTranslateTo: 'Automatyczne tłumaczenie na:'
    },
    pt: {
      subtitleFileDownload: 'Download do arquivo de legendas: ',
      selectSpeechSubtitles: 'Selecione as legendas de fala para reproduzir junto com o vídeo: ',
      AutoTranslateTo: 'Tradução automática para:'
    },
    ar: {
      subtitleFileDownload: 'تحميل ملف الترجمة: ',
      selectSpeechSubtitles: 'حدد ترجمات الكلام لتشغيلها جنبًا إلى جنب مع الفيديو: ',
      AutoTranslateTo: 'ترجمة تلقائية إلى:'
    },
    hi: {
      subtitleFileDownload: 'सबटाइटल फ़ाइल डाउनलोड करें: ',
      selectSpeechSubtitles: 'वीडियो के साथ खेलने के लिए भाषण उपशीर्षक का चयन करें: ',
      AutoTranslateTo: 'स्वतः इसका अनुवाद करें:'
    },
    zh: {
      subtitleFileDownload: '字幕文件下载：',
      selectSpeechSubtitles: '选择要与视频一起播放的语音字幕：',
      AutoTranslateTo: '自动翻译成：'
    },
    es: {
      subtitleFileDownload: 'Descargar archivo de subtítulos: ',
      selectSpeechSubtitles: 'Seleccione los subtítulos de voz para reproducir junto al video: ',
      AutoTranslateTo: 'Traducir automáticamente a:'
    },
  };

  removeIfAlreadyExists()

  const userLanguage = navigator.language.substring(0, 2);
  const texts = languageTexts[userLanguage] || languageTexts['en']; // Fallback to English if user language is not defined

  const container = createOutterContainer(texts.subtitleFileDownload, CONTAINER_ID);
  captionTracks.forEach(track => {
    const link = createDownloadLink(track, languageTexts)
    container.appendChild(link)
  });

  const container2 = createOutterContainer(texts.selectSpeechSubtitles, CONTAINER_ID2);
  captionTracks.forEach(track => {
    const link = createSelectionLink(track, languageTexts)
    container2.appendChild(link)
  });

  addToCurrentPage(container);
  addToCurrentPage(container2);
}


/**
 * Add HTML to the current page.
 * @param {HTMLDivElement} container container containing HTML
 */
const addToCurrentPage = container => {
  insertPosition.parentNode.insertBefore(container, insertPosition)
}


/**
 * Only 'view video' page can contain subtitle links.
 * Should only handle 'view video' page, not 'search' page, 'setting' page,...
 * TODO: Having to run according to the YouTube interface, so it should be in Popup to not be dependent.
 * @return {Boolean}
 */
const canInsert = () => {
  const selectorList = [
    // New GUI in Firefox 103
    '#bottom-row',

    // Old GUI
    '#meta #meta-contents #container #top-row'
  ]

  // find the position above the name of the Channel
  for (const selector of selectorList) {
    insertPosition = document.querySelector(selector)
    if (insertPosition) {
      // insertPosition.style.border = '1rem solid #000'
      return true
    }
  }

  return false
}


/**
 * Create the outter container
 * @param {String} text String of display labels
 * @return {HTMLDivElement}
 */
const createOutterContainer = (text, id) => {
  const container = document.createElement('div')
  container.setAttribute('id', id)
  container.style.padding = '5px 5px 5px 0'
  container.style.margin = '5px 0'
  container.style.color = 'darkgrey'
  container.style.fontSize = '1.4rem'
  container.style.overflowWrap = 'break-word'
  container.style.whiteSpace = 'break-spaces'
  container.style.lineHeight = 1
  container.textContent = text
  return container
}


/**
 * Create download link.
 * @param {Object} track subtitle object
 * @return {HTMLLinkElement}
 */
const createDownloadLink = track => {
  const link = document.createElement('a')
  // Don't use the track.languageCode attribute because it's code
  // The track.name.simpleText property is always visible (auto-generated)
  // Also can check by attribute track.kind is asr
  link.textContent = track.name.simpleText
  link.href = 'javascript:;'
  link.title = 'Please click to download'

  // CSS
  link.style.marginLeft = '5px'
  link.style.cursor = 'pointer'
  link.style.color = 'pink'
  link.style.textDecoration = 'underline'
  link.style.background = 'transparent'
  link.style.border = 'none'
  link.style.fontSize = '1.4rem'

  // Click to download
  link.addEventListener('click', () => {
    downloadCaptionFile(track)
  })
  return link
}

const createSelectionLink = (track, languageTexts) => {
  const languages = [
    { languageCode: "af", languageName: "Afrikaans" },
    { languageCode: "ak", languageName: "Akan" },
    { languageCode: "sq", languageName: "Albanian" },
    { languageCode: "am", languageName: "Amharic" },
    { languageCode: "ar", languageName: "Arabic" },
    { languageCode: "hy", languageName: "Armenian" },
    { languageCode: "as", languageName: "Assamese" },
    { languageCode: "ay", languageName: "Aymara" },
    { languageCode: "az", languageName: "Azerbaijani" },
    { languageCode: "bn", languageName: "Bangla" },
    { languageCode: "eu", languageName: "Basque" },
    { languageCode: "be", languageName: "Belarusian" },
    { languageCode: "bho", languageName: "Bhojpuri" },
    { languageCode: "bs", languageName: "Bosnian" },
    { languageCode: "bg", languageName: "Bulgarian" },
    { languageCode: "my", languageName: "Burmese" },
    { languageCode: "ca", languageName: "Catalan" },
    { languageCode: "ceb", languageName: "Cebuano" },
    { languageCode: "zh", languageName: "Chinese (Simplified)" },
    { languageCode: "zh", languageName: "Chinese (Traditional)" },
    { languageCode: "co", languageName: "Corsican" },
    { languageCode: "hr", languageName: "Croatian" },
    { languageCode: "cs", languageName: "Czech" },
    { languageCode: "da", languageName: "Danish" },
    { languageCode: "dv", languageName: "Divehi" },
    { languageCode: "nl", languageName: "Dutch" },
    { languageCode: "en", languageName: "English" },
    { languageCode: "eo", languageName: "Esperanto" },
    { languageCode: "et", languageName: "Estonian" },
    { languageCode: "ee", languageName: "Ewe" },
    { languageCode: "fil", languageName: "Filipino" },
    { languageCode: "fi", languageName: "Finnish" },
    { languageCode: "fr", languageName: "French" },
    { languageCode: "gl", languageName: "Galician" },
    { languageCode: "lg", languageName: "Ganda" },
    { languageCode: "ka", languageName: "Georgian" },
    { languageCode: "de", languageName: "German" },
    { languageCode: "el", languageName: "Greek" },
    { languageCode: "gn", languageName: "Guarani" },
    { languageCode: "gu", languageName: "Gujarati" },
    { languageCode: "ht", languageName: "Haitian Creole" },
    { languageCode: "ha", languageName: "Hausa" },
    { languageCode: "haw", languageName: "Hawaiian" },
    { languageCode: "iw", languageName: "Hebrew" },
    { languageCode: "hi", languageName: "Hindi" },
    { languageCode: "hmn", languageName: "Hmong" },
    { languageCode: "hu", languageName: "Hungarian" },
    { languageCode: "is", languageName: "Icelandic" },
    { languageCode: "ig", languageName: "Igbo" },
    { languageCode: "id", languageName: "Indonesian" },
    { languageCode: "ga", languageName: "Irish" },
    { languageCode: "it", languageName: "Italian" },
    { languageCode: "ja", languageName: "Japanese" },
    { languageCode: "jv", languageName: "Javanese" },
    { languageCode: "kn", languageName: "Kannada" },
    { languageCode: "kk", languageName: "Kazakh" },
    { languageCode: "km", languageName: "Khmer" },
    { languageCode: "rw", languageName: "Kinyarwanda" },
    { languageCode: "ko", languageName: "Korean" },
    { languageCode: "kri", languageName: "Krio" },
    { languageCode: "ku", languageName: "Kurdish" },
    { languageCode: "ky", languageName: "Kyrgyz" },
    { languageCode: "lo", languageName: "Lao" },
    { languageCode: "la", languageName: "Latin" },
    { languageCode: "lv", languageName: "Latvian" },
    { languageCode: "ln", languageName: "Lingala" },
    { languageCode: "lt", languageName: "Lithuanian" },
    { languageCode: "lb", languageName: "Luxembourgish" },
    { languageCode: "mk", languageName: "Macedonian" },
    { languageCode: "mg", languageName: "Malagasy" },
    { languageCode: "ms", languageName: "Malay" },
    { languageCode: "ml", languageName: "Malayalam" },
    { languageCode: "mt", languageName: "Maltese" },
    { languageCode: "mi", languageName: "Māori" },
    { languageCode: "mr", languageName: "Marathi" },
    { languageCode: "mn", languageName: "Mongolian" },
    { languageCode: "ne", languageName: "Nepali" },
    { languageCode: "nso", languageName: "Northern Sotho" },
    { languageCode: "no", languageName: "Norwegian" },
    { languageCode: "ny", languageName: "Nyanja" },
    { languageCode: "or", languageName: "Odia" },
    { languageCode: "om", languageName: "Oromo" },
    { languageCode: "ps", languageName: "Pashto" },
    { languageCode: "fa", languageName: "Persian" },
    { languageCode: "pl", languageName: "Polish" },
    { languageCode: "pt", languageName: "Portuguese" },
    { languageCode: "pa", languageName: "Punjabi" },
    { languageCode: "qu", languageName: "Quechua" },
    { languageCode: "ro", languageName: "Romanian" },
    { languageCode: "ru", languageName: "Russian" },
    { languageCode: "sm", languageName: "Samoan" },
    { languageCode: "sa", languageName: "Sanskrit" },
    { languageCode: "gd", languageName: "Scottish Gaelic" },
    { languageCode: "sr", languageName: "Serbian" },
    { languageCode: "sn", languageName: "Shona" },
    { languageCode: "sd", languageName: "Sindhi" },
    { languageCode: "si", languageName: "Sinhala" },
    { languageCode: "sk", languageName: "Slovak" },
    { languageCode: "sl", languageName: "Slovenian" },
    { languageCode: "so", languageName: "Somali" },
    { languageCode: "st", languageName: "Southern Sotho" },
    { languageCode: "es", languageName: "Spanish" },
    { languageCode: "su", languageName: "Sundanese" },
    { languageCode: "sw", languageName: "Swahili" },
    { languageCode: "sv", languageName: "Swedish" },
    { languageCode: "tg", languageName: "Tajik" },
    { languageCode: "ta", languageName: "Tamil" },
    { languageCode: "tt", languageName: "Tatar" },
    { languageCode: "te", languageName: "Telugu" },
    { languageCode: "th", languageName: "Thai" },
    { languageCode: "ti", languageName: "Tigrinya" },
    { languageCode: "ts", languageName: "Tsonga" },
    { languageCode: "tr", languageName: "Turkish" },
    { languageCode: "tk", languageName: "Turkmen" },
    { languageCode: "uk", languageName: "Ukrainian" },
    { languageCode: "ur", languageName: "Urdu" },
    { languageCode: "ug", languageName: "Uyghur" },
    { languageCode: "uz", languageName: "Uzbek" },
    { languageCode: "vi", languageName: "Vietnamese" },
    { languageCode: "cy", languageName: "Welsh" },
    { languageCode: "fy", languageName: "Western Frisian" },
    { languageCode: "xh", languageName: "Xhosa" },
    { languageCode: "yi", languageName: "Yiddish" },
    { languageCode: "yo", languageName: "Yoruba" },
    { languageCode: "zu", languageName: "Zulu" }]

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `checkbox_${track.name.simpleText.replace(/\s/g, '_')}`;
  checkbox.style.marginLeft = '0px';

  const label = document.createElement('label');
  label.textContent = track.name.simpleText;
  label.htmlFor = checkbox.id;
  label.style.cursor = 'pointer';
  label.style.color = 'pink';
  label.style.textDecoration = 'underline';
  label.style.fontSize = '1.4rem';

  const dropdown = document.createElement('select');
  dropdown.id = `dropdown_${track.name.simpleText.replace(/\s/g, '_')}`;
  dropdown.style.backgroundColor = '#333333';
  dropdown.style.color = '#ffffff';
  dropdown.style.border = 'none';
  dropdown.style.cursor = 'pointer';
  dropdown.style.marginLeft = '5px';

  const defaultOption = document.createElement('option');

  const userLanguage = navigator.language.substring(0, 2);
  const texts = languageTexts[userLanguage] || languageTexts['en']; // Fallback to English if user language is not define

  if (speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode !== null) {
    for (const language of languages) {
      if (language.languageCode == speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode) {
        defaultOption.value = language.languageCode;
        defaultOption.text = language.languageName;
        break;
      }
    }
  } else { defaultOption.text = texts.AutoTranslateTo; }

  dropdown.add(defaultOption);

  languages.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.languageCode;
    option.text = language.languageName;
    dropdown.add(option);
  });

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.appendChild(checkbox);
  container.appendChild(label);
  container.appendChild(dropdown);

  let selectedLanguageCode = null;

  // Click event listener for the checkbox
  checkbox.addEventListener('change', () => {
    clearInterval(intervalId);
    if (checkbox.checked) {

      // Retrieve the selected language code from the dropdown
      const selectedLanguageCode = dropdown.value;

      if (selectedLanguageCode) {
        selectCaptionFileForTTS(track, selectedLanguageCode);
      } else if (speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode !== null) {
        selectCaptionFileForTTS(track, speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode);
      }
      else {
        selectCaptionFileForTTS(track);
      }

      // Deselect other checkboxes
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((otherCheckbox) => {
        if (otherCheckbox !== checkbox) {
          otherCheckbox.checked = false;
        }
      });
    }
  });

  // Change event listener for the dropdown
  dropdown.addEventListener('change', () => {
    clearInterval(intervalId);

    if (dropdown.value === '') {
      selectedLanguageCode = null;
    } else {
      selectedLanguageCode = dropdown.value;
    }
    speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode = selectedLanguageCode;
    browser.storage.local.set({ speechSettings: speechSettings });

    checkbox.checked = true;

    //below is important, as `checkbox.checked = true` doesn't trigger even listener for some reason
    selectCaptionFileForTTS(track, selectedLanguageCode);

  });

  return container;
};

/**
 * Check if the container already exists (so we don't have to process again).
 */
const removeIfAlreadyExists = () => {

  const container = document.getElementById(CONTAINER_ID)
  if (container != null) container.parentNode.removeChild(container);

  const container2 = document.getElementById(CONTAINER_ID2)
  if (container2 != null) container2.parentNode.removeChild(container2);
}


/**
 * Notify that there is no subtitle.
 */
const notifyNotFound = () => {
  removeIfAlreadyExists()
  const container = createOutterContainer('No subtitle', CONTAINER_ID)
  addToCurrentPage(container)
}

/**
* Get parameter value from URL.
* @param {String} param Parameter name
* @return {String} Parameter value
*/
const getParameter = param => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(param)
}

/**
 * Save text file (by JS).
 * @param {String} text The content of the text to be saved
 * @param {String} fileName Filename
 */
const saveTextAsFile = (text, fileName) => {
  const textFileAsBlob = new Blob([text], { type: 'text/plain' })
  const hrefLink = window.URL.createObjectURL(textFileAsBlob)

  const downloadLink = document.createElement('a')
  downloadLink.download = fileName
  downloadLink.textContent = 'Download file'
  downloadLink.href = hrefLink
  downloadLink.style.display = 'none'
  downloadLink.addEventListener('click', evt => {
    document.body.removeChild(evt.target)
  })
  document.body.appendChild(downloadLink)
  downloadLink.click()
}


/**
 * Return original form (unescaped) of escaped characters.
 * There are cases where the string is &amp;quot; therefore need to replace &amp; before
 * @param {String} inputText Input String
 * @return {String}
 */
const unescapeHTML = inputText => {
  const ESCAPE_SEQ = [
    /&amp;/g,
    /&quot;/g,
    /&lt;/g,
    /&gt;/g,
    /&#39;/g
  ]
  const UNESCAPE_SEQ = [
    '&',
    '"',
    '<',
    '>',
    '\''
  ]
  for (let i = 0; i < ESCAPE_SEQ.length; i++) {
    inputText = inputText.replace(ESCAPE_SEQ[i], UNESCAPE_SEQ[i])
  }
  return inputText
}

let currentUrl = ''


/**
  * This function will be called periodically.
  * Check if the URL has changed.
  */
const checkSubtitle = () => {
  const newUrl = location.href
  if (currentUrl !== newUrl) {
    clearInterval(intervalId);
    const videoId = extractVideoId();
    if (videoId && canInsert()) {
      currentUrl = newUrl;
      getSubtitleList(videoId);
    } else if (videoId && !canInsert()) {
      //console.log('Cannot insert (yet)');
    } else {
      // If it's an address but not a viewing, there's no video, stop it
      currentUrl = newUrl;
    }
  }

  // Call periodically again
  setTimeout(checkSubtitle, 500)
}


const init = () => {
  setTimeout(checkSubtitle, 0)
}


/**
 * @return {String}
 */
const extractVideoId = () => {
  return getParameter('v')
}


/**
 * @param {String} videoId Video ID
 */
const getSubtitleList = async videoId => {
  const url = 'https://www.youtube.com/watch?v=' + videoId
  const html = await fetch(url).then(resp => resp.text())
  const regex = /\{"captionTracks":(\[.*?\]),/g
  const arr = regex.exec(html)
  arr == null ? notifyNotFound() : buildGui(JSON.parse(arr[1]));
}


init()

/**
 * Convert from YouTube closed caption format to srt format.
 * @param {String} xml 
 * @return {String}
 */
const convertFromTimedToSrtFormat = xml => {
  // Example 1 data line:
  // <text start="9720" dur="2680">Lately, I've been, I've been thinking</p>
  // First is the start time
  // Next is the length
  // Next is the content string
  let content = ''
  let count = 1

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xml, 'text/xml')
  const arr = [...xmlDoc.getElementsByTagName('text')]
  arr.forEach(text => {
    const startTime = parseFloat(text.getAttribute('start'))
    const duration = parseFloat(text.getAttribute('dur'))
    // Using text.nodeValue will output null
    // Must use text.textContent or text.childNodes[0].nodeValue
    // Using text.textContent will automatically replace characters like &quot;,
    // use text.childNodes[0].nodeValue not
    // const orginalText = text.textContent
    const orginalText = (text.childNodes && text.childNodes.length) ? text.childNodes[0].nodeValue : ''

    const endTime = startTime + duration
    const normalizedText = orginalText.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim()

    if (normalizedText) {
      content += `${count}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${normalizedText}\n\n`;
      count++;
    }
  })
  return unescapeHTML(content)
}


/**
 * Format the time (that is in second) to the hh:mm:ss,SSS.
 * @param {Float} timeInSec Time in seconds
 * @return {String}
 */
const formatTime = timeInSec => {
  const SSS = Math.floor(timeInSec * 1000) % 1000
  timeInSec = Math.floor(timeInSec)
  const hh = Math.floor(timeInSec / 3600)
  const mm = Math.floor((timeInSec - hh * 3600) / 60)
  const ss = timeInSec - hh * 3600 - mm * 60
  return (
    fillZero(hh, 2) + ':'
    + fillZero(mm, 2) + ':'
    + fillZero(ss, 2) + ','
    + fillZero(SSS, 3)
  )
}


/**
 * Fill the zero (0) to the left (padding)
 * @param {Integer} num
 * @param {Integer} len
 * @return {String}
 */
const fillZero = (num, len) => {
  let result = '' + num
  for (let i = result.length; i < len; i++) {
    result = '0' + result
  }
  return result
}

/**
 * Ads were breaking up my extension experience to end users. If they have an ad blocker installed, then that wasn't even an issue, but for the ones without an ad blocker, it was a problem. Therefore, the solution is to remove YouTube ads.
 */
setInterval(function () {
  if (document.getElementsByClassName("video-stream html5-main-video")[0] !== undefined) {
    let ad = document.getElementsByClassName("video-ads ytp-ad-module")[0];
    let vid = document.getElementsByClassName("video-stream html5-main-video")[0];

    let closeAble = document.getElementsByClassName("ytp-ad-overlay-close-button");
    for (let i = 0; i < closeAble.length; i++) {
      closeAble[i].click();
      //console.log("ad banner closed!")
    }
    if (document.getElementsByClassName("style-scope ytd-watch-next-secondary-results-renderer sparkles-light-cta GoogleActiveViewElement")[0] !== undefined) {
      let sideAd = document.getElementsByClassName("style-scope ytd-watch-next-secondary-results-renderer sparkles-light-cta GoogleActiveViewElement")[0];
      sideAd.style.display = "none";
      //console.log("side ad removed!")
    }
    if (document.getElementsByClassName("style-scope ytd-item-section-renderer sparkles-light-cta")[0] !== undefined) {
      let sideAd_ = document.getElementsByClassName("style-scope ytd-item-section-renderer sparkles-light-cta")[0];
      sideAd_.style.display = "none";
      //console.log("side ad removed!")
    }
    if (document.getElementsByClassName("ytp-ad-text ytp-ad-skip-button-text")[0] !== undefined) {
      let skipBtn = document.getElementsByClassName("ytp-ad-text ytp-ad-skip-button-text")[0];
      skipBtn.click();
      //console.log("skippable ad skipped!")
    }
    if (document.getElementsByClassName("ytp-ad-message-container")[0] !== undefined) {
      let incomingAd = document.getElementsByClassName("ytp-ad-message-container")[0];
      incomingAd.style.display = "none";
      //console.log("removed incoming ad alert!")
    }
    if (document.getElementsByClassName("style-scope ytd-companion-slot-renderer")[0] !== undefined) {
      document.getElementsByClassName("style-scope ytd-companion-slot-renderer")[0].remove();
      //console.log("side ad removed!")
    }
    if (ad !== undefined) {
      if (ad.children.length > 0) {
        if (document.getElementsByClassName("ytp-ad-text ytp-ad-preview-text")[0] !== undefined) {
          vid.playbackRate = 16;
          //console.log("Incrementally skipped unskippable ad!")
        }
      }
    }
  }
}, 1000)

// Listen for messages from the settings.js file
browser.runtime.onMessage.addListener(function (message) {
  clearInterval(intervalId);

  const speechVoice = message.voice;
  const dropdowns = document.querySelectorAll('[id^="dropdown_"]');

  const isGoogleTranslate_Voice = speechVoice.startsWith("GoogleTranslate_");

  let languageCode;

  if (isGoogleTranslate_Voice) {
    languageCode = speechVoice.replace("GoogleTranslate_", "");
    speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode = speechVoice.replace("GoogleTranslate_", "");
  } else {
    languageCode = voices.find((voice) => voice.voiceURI === speechVoice);
    speechSettings.rememberUserLastSelectedAutoTranslateToLanguageCode = languageCode.lang.substring(0, 2);
  }

  dropdowns.forEach(function (dropdown) {
    let selectedOption;

    if (isGoogleTranslate_Voice) {
      selectedOption = Array.from(dropdown.options).find(option => option.value.substring(0, 2) === languageCode);
    } else {
      // Find the option with the matching languageCode
      // option.value has to be .substring(0, 2) due to Chinese code having more chars than that
      selectedOption = Array.from(dropdown.options).find(option => option.value.substring(0, 2) === languageCode.lang.substring(0, 2));
    }

    // Set the selectedIndex of the dropdown to the index of the selected option
    if (selectedOption) {
      dropdown.selectedIndex = selectedOption.index;
    }

    // Assuming the checkbox was created as a sibling of the dropdown within the same container
    const container = dropdown.parentNode;
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (checkbox) {
      if (checkbox.checked) { //checks if it was checked
        // Trigger the 'change' event on the checkbox. I had to do it that way, as checkbox.checked = isChecked wasn't triggering an event - checked with the debugger!
        const event = new Event('change');
        checkbox.dispatchEvent(event);
      }
    }
  });

});
