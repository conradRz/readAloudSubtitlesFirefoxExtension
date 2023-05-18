// Listen for clicks on the extension button in the toolbar
browser.browserAction.onClicked.addListener(tab => {
  openSettingsWindow();
  // Send a message to the content script to read out the subtitles
  browser.tabs.sendMessage(tab.id, { action: 'readSubtitles', tabId: tab.id });

});

function openSettingsWindow() {
  browser.browserAction.setPopup({
    popup: 'settings.html'
  });
}
