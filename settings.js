//console.log('base seetings.js file check');

document.addEventListener('DOMContentLoaded', () => {
    let speedSlider = document.getElementById('speedSlider');
    let volumeSlider = document.getElementById('volumeSlider');

    // Add event listeners to the sliders
    speedSlider.addEventListener('input', handleSpeedChange);
    volumeSlider.addEventListener('input', handleVolumeChange);

    // Function to handle speed slider change
    function handleSpeedChange(event) {
        // Perform actions with the speed value
        console.log('Speed value:', event.target.value);
        speechSettings.speechSpeed = parseFloat(event.target.value);
    }

    // Function to handle volume slider change
    function handleVolumeChange(event) {
        // Perform actions with the volume value
        console.log('Volume value:', event.target.value);
        speechSettings.speechVolume = parseFloat(event.target.value);
    }
});
