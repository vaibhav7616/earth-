// Initialize the Cesium Viewer with base settings
const viewer = new Cesium.Viewer('canvas-container', {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: true,
    animation: false,
    timeline: false,
    fullscreenButton: true,
    creditContainer: document.createElement('div'),
});

// Explicitly remove default blue layer and force high-res satellite
viewer.imageryLayers.removeAll();

// Provide ArcGIS World Imagery (Green trees, Blue water, Real satellite imagery)
viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19
}));

// Enable accurate real-world lighting so the planet is truly "rotated to the sun"
viewer.scene.globe.enableLighting = true;

// Enhance the atmosphere for a premium look
viewer.scene.skyAtmosphere.hueShift = -0.05;
viewer.scene.skyAtmosphere.saturationShift = 0.2;
viewer.scene.skyAtmosphere.brightnessShift = 0.1;

// Make zooming smoother
viewer.scene.screenSpaceCameraController.enableDamping = true;
viewer.scene.screenSpaceCameraController.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH
];

// Start focused out beautifully in space!
viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(20.0, 20.0, 25000000.0),
    duration: 3.0
});

// Auto-Rotation logic
let autoRotate = true;
let lastCameraPosition = viewer.camera.position.clone();

viewer.clock.onTick.addEventListener(function(clock) {
    // If user interacts, stop auto rotation
    if (!viewer.camera.position.equalsEpsilon(lastCameraPosition, 1.0)) {
        autoRotate = false;
    }
    
    // Rotate very slowly
    if (autoRotate) {
        viewer.scene.camera.rotateLeft(0.0005);
    }
    lastCameraPosition = viewer.camera.position.clone();
});

// Custom Search Bar using totally free OSM Nominatim (No tokens required)
document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('search-input').value;
    if (!query) return;

    // Show loading state implicitly or explicit
    const button = e.target.querySelector('button');
    button.textContent = '...';

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            
            // Fly the camera dramatically to the searched location!
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, 10000.0), // Zoom in up to 10km height
                duration: 3.0
            });
            
            // Turn off auto-rotate to prevent frustrating the user
            autoRotate = false;
        } else {
            alert('Location not found! Try a broader search term.');
        }
    } catch (err) {
        console.error('Search failed', err);
    } finally {
        button.textContent = 'Go';
    }
});
