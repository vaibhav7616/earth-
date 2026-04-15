import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Setup Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 40, 100);

// Setup Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 1000;

// Texture Loader
const textureLoader = new THREE.TextureLoader();

const texturePath = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/";

// Base Planet Data (Sizes and distances are stylized for web viewing, not 1:1 scale)
const planetsData = [
  { name: 'Mercury', size: 0.8, distance: 15, texture: 'moon_1024.jpg', speed: 0.015 },
  { name: 'Venus', size: 1.5, distance: 22, texture: 'venus_surface_2048.jpg', speed: 0.012 },
  { name: 'Earth', size: 1.6, distance: 30, speed: 0.01 }, // Handled explicitly for clouds/moon
  { name: 'Mars', size: 1.2, distance: 38, texture: 'mars_1k_color.jpg', speed: 0.008 },
  { name: 'Jupiter', size: 3.5, distance: 55, texture: 'jupiter_1024.jpg', speed: 0.005 },
  { name: 'Saturn', size: 3.0, distance: 75, texture: 'saturn_1024.jpg', speed: 0.004, hasRing: true },
  { name: 'Uranus', size: 2.2, distance: 95, texture: 'uranus_1024.jpg', speed: 0.003 },
  { name: 'Neptune', size: 2.1, distance: 110, texture: 'neptune_1024.jpg', speed: 0.002 }
];

const planets = [];

// --- SUN ---
const sunGeometry = new THREE.SphereGeometry(6, 64, 64);
const sunMaterial = new THREE.MeshBasicMaterial({ 
    map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/sun.jpg'),
    color: 0xffffff // Makes the texture bright
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Sun Light (PointLight illuminating everything)
const sunLight = new THREE.PointLight(0xffffff, 1500, 500, 2); 
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;
scene.add(sunLight);

// Very soft ambient light for deep space
scene.add(new THREE.AmbientLight(0x111111));

// --- PLANETS GENERATION ---
planetsData.forEach((data) => {
    // Group handles the orbital rotation around the sun
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    // Mesh
    let material;
    let planetMesh;

    if (data.name === 'Earth') {
        const earthGeometry = new THREE.SphereGeometry(data.size, 64, 64);
        material = new THREE.MeshStandardMaterial({
            map: textureLoader.load(texturePath + 'earth_atmos_2048.jpg'),
            roughnessMap: textureLoader.load(texturePath + 'earth_specular_2048.jpg'),
            normalMap: textureLoader.load(texturePath + 'earth_normal_2048.jpg'),
            metalness: 0.1, roughness: 0.8
        });
        planetMesh = new THREE.Mesh(earthGeometry, material);
        
        // Clouds
        const cloudGeometry = new THREE.SphereGeometry(data.size * 1.02, 64, 64);
        const cloudMaterial = new THREE.MeshStandardMaterial({
            map: textureLoader.load(texturePath + 'earth_clouds_1024.png'),
            transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        planetMesh.add(clouds);
        data.clouds = clouds;

        // Moon
        const moonGroup = new THREE.Group();
        planetMesh.add(moonGroup);
        const moonGeo = new THREE.SphereGeometry(data.size * 0.27, 32, 32);
        const moonMat = new THREE.MeshStandardMaterial({
            map: textureLoader.load(texturePath + 'moon_1024.jpg')
        });
        const moon = new THREE.Mesh(moonGeo, moonMat);
        moon.position.set(data.size * 2.5, 0, 0); // distance from earth
        moonGroup.add(moon);
        data.moonGroup = moonGroup;

    } else {
        const geometry = new THREE.SphereGeometry(data.size, 64, 64);
        material = new THREE.MeshStandardMaterial({
            map: textureLoader.load(texturePath + data.texture),
            metalness: 0.2, roughness: 0.7
        });
        planetMesh = new THREE.Mesh(geometry, material);

        if (data.hasRing) {
            // Simple generic ring for Saturn
            const ringGeo = new THREE.RingGeometry(data.size * 1.3, data.size * 2.2, 64);
            const ringMat = new THREE.MeshStandardMaterial({
                map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/saturn_ring_1024.png'),
                side: THREE.DoubleSide, transparent: true
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2 + 0.2;
            planetMesh.add(ring);
        }
    }

    planetMesh.position.set(data.distance, 0, 0);
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    
    // Tilt planets slightly for realism
    planetMesh.rotation.z = Math.random() * 0.4;
    
    orbitGroup.add(planetMesh);

    planets.push({
        name: data.name,
        mesh: planetMesh,
        group: orbitGroup,
        speed: data.speed,
        clouds: data.clouds,
        moonGroup: data.moonGroup
    });
});

// --- STARS ---
const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
const starVertices = [];
for(let i=0; i<6000; i++) {
    const r = 400 + Math.random() * 600;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    starVertices.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
scene.add(new THREE.Points(starGeometry, starMaterial));

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Rotate Sun
    sun.rotation.y = time * 0.05;

    // Rotate and orbit all planets
    planets.forEach(p => {
        // Orbit
        p.group.rotation.y = time * p.speed;
        // Axis spin
        p.mesh.rotation.y = time * 0.5;
        
        // Earth specific animations
        if (p.name === 'Earth') {
            p.clouds.rotation.y = time * 0.55;
            p.moonGroup.rotation.y = time * 1.5;
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
