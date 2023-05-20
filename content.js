// Listen for messages from the background script
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'updateSpeechSettings') {
    speechSettings = message.speechSettings;
  }
});


// ID of the container
const CONTAINER_ID = 'captionDownloadContainer'

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

const selectCaptionFileForTTS = async track => {
  const url = track.baseUrl
  const xml = await fetch(url).then(resp => resp.text())

  if (xml) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const textElements = xmlDoc.getElementsByTagName('text');

    let currentTime;
    let isSpeechSynthesisInProgress = false;

    let subtitlePart = '';
    let newSubtitlePart = '';
    //debugger;
    let matchedText = '';

    function matchXmlTextToCurrentTime() {
      currentTime = document.getElementsByClassName('video-stream')[0].currentTime;

      for (let i = 0; i < textElements.length; i++) {
        const start = parseFloat(textElements[i].getAttribute('start'));
        const duration = parseFloat(textElements[i].getAttribute('dur'));
        const end = start + duration;

        if (currentTime >= start && currentTime <= end) {
          matchedText = textElements[i].textContent.trim();
          break;
        }
      }

      if (matchedText) {
        newSubtitlePart = matchedText;
        if ((newSubtitlePart !== subtitlePart) && !isSpeechSynthesisInProgress) {

          subtitlePart = newSubtitlePart;

          isSpeechSynthesisInProgress = true;
          let utterance = new SpeechSynthesisUtterance(unescapeHTML(matchedText.replace(/\n/g, "").replace(/\\"/g, '"').trim().replace(/[,\.]+$/, ''))); //.replace(/[,\.]+$/, '') trims trailing , and . which makes the subtitle playing smoother in my subjective opinion
          utterance.rate = speechSettings.speechSpeed;
          utterance.volume = speechSettings.speechVolume;

          utterance.onend = function () {
            isSpeechSynthesisInProgress = false;
            setTimeout(matchXmlTextToCurrentTime, 100);
          };

          speechSynthesis.speak(utterance);
        } else { setTimeout(matchXmlTextToCurrentTime, 100) }
      }
    }
    setInterval(matchXmlTextToCurrentTime, 100);
  }
}

/**
 * Displays a list of subtitles that the video has.
 * @param {Array} captionTracks Subtitles array.
 */
const buildGui = captionTracks => {
  removeIfAlreadyExists()

  const container = createOutterContainer('Subtitle file download: ')
  captionTracks.forEach(track => {
    const link = createDownloadLink(track)
    container.appendChild(link)
  })

  const container2 = createOutterContainer('Tick subtitle for speech for when video plays: ')
  captionTracks.forEach(track => {
    const link = createSelectionLink(track)
    container2.appendChild(link)
  })

  addToCurrentPage(container)
  addToCurrentPage(container2)
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
const createOutterContainer = text => {
  const container = document.createElement('div')
  container.setAttribute('id', CONTAINER_ID)
  container.style.padding = '5px 5px 5px 0'
  container.style.margin = '5px 0'
  container.style.color = 'darkgrey'
  container.style.fontSize = '1.4rem'
  container.style.lineHeight = .75
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
  link.style.marginLeft = '0px'
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

const createSelectionLink = (track) => {
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

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.appendChild(checkbox);
  container.appendChild(label);

  // Click event listener for the checkbox
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      selectCaptionFileForTTS(track);
    }
  });

  return container;
};


/**
 * Check if the container already exists (show we don't have to process again).
 */
const removeIfAlreadyExists = () => {
  const container = document.getElementById(CONTAINER_ID)
  if (container != null) {
    container.parentNode.removeChild(container);
    container.parentNode.removeChild(container) //this being twice is not a mistake. If it's once, it will remove only one container
  }
}


/**
 * Notify that there is no subtitle.
 */
const notifyNotFound = () => {
  removeIfAlreadyExists()
  const container = createOutterContainer('No subtitle')
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

let speechSettings = {
  speechSpeed: 1.5,
  speechVolume: 1
};

let currentUrl = ''


/**
  * This function will be called periodically.
  * Check if the URL has changed.
  */
const checkSubtitle = () => {
  const newUrl = location.href
  if (currentUrl != newUrl) {
    const videoId = extractVideoId()
    if (videoId) {
      // If it's a video address
      if (canInsert()) {
        // If possible add
        currentUrl = newUrl
        getSubtitleList(videoId)
      } else {
        console.log('Cannot insert (yet)')
      }
    } else {
      // If it's an address but not a viewing, there's no video, stop it
      currentUrl = newUrl
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
  if (arr == null) {
    notifyNotFound()
  } else {
    const captionTracks = JSON.parse(arr[1])
    buildGui(captionTracks)
  }
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
    // console.log(startTime, duration, orginalText)

    const endTime = startTime + duration
    const normalizedText = orginalText
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim()

    if (normalizedText) {
      content += count + '\n'
        + formatTime(startTime) + ' --> ' + formatTime(endTime) + '\n'
        + normalizedText + '\n\n'
      count++
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
