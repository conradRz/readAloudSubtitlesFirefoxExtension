console.log('base seetings.js file check');
console.log(console.log(speechSettings.speechSpeed))
console.log(console.log(speechSettings.speechVolume))

document.addEventListener('DOMContentLoaded', () => {
    console.log('Inside DOMContentLoaded event');
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
        speechSettings.speechVolume = parseFloat(event.target.value);
    }
});
