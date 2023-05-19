// Listen for clicks on the extension button in the toolbar
browser.browserAction.onClicked.addListener(tab => {
    openSettingsWindow();
});

function openSettingsWindow() {
    browser.browserAction.setPopup({
        popup: 'settings.html'
    });
}