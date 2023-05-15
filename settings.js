document.addEventListener('DOMContentLoaded', () => {
    const speedSlider = document.getElementById('speedSlider');
    const volumeSlider = document.getElementById('volumeSlider');

    // Add event listeners to the sliders
    speedSlider.addEventListener('input', handleSpeedChange);
    volumeSlider.addEventListener('input', handleVolumeChange);

    // Function to handle speed slider change
    function handleSpeedChange(event) {
        const speedValue = parseFloat(event.target.value);
        // Perform actions with the speed value
        console.log('New speed value:', speedValue);
        // Update your extension behavior based on the speed value
    }

    // Function to handle volume slider change
    function handleVolumeChange(event) {
        const volumeValue = parseInt(event.target.value);
        // Perform actions with the volume value
        console.log('New volume value:', volumeValue);
        // Update your extension behavior based on the volume value
    }
});
