// Listen for clicks on the extension button in the toolbar
browser.browserAction.onClicked.addListener(tab => {
  // Send a message to the content script to read out the subtitles
  browser.tabs.sendMessage(tab.id, { action: 'readSubtitles' });

  browser.runtime.openOptionsPage();
});
