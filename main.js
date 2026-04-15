/**
 * Celestial 3D - Ultra-Realistic Solar System & Earth Explorer
 */

const scene = new THREE.Scene();
const clock = new THREE.Clock();

// --- CONFIGURATION ---
const TEXTURE_BASE = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/";
const planetsData = [
    { name: 'Mercury', size: 2, distance: 80, speed: 0.015, color: '#8c8c8c' },
    { name: 'Venus', size: 4, distance: 130, speed: 0.012, color: '#e3bb76' },
    { name: 'Earth', size: 5, distance: 200, speed: 0.01, isEarth: true },
    { name: 'Mars', size: 3, distance: 280, speed: 0.008, color: '#cf6140' },
    { name: 'Jupiter', size: 15, distance: 450, speed: 0.005, color: '#d39c7e' },
    { name: 'Saturn', size: 13, distance: 650, speed: 0.004, hasRing: true, color: '#c5ab6e' },
    { name: 'Uranus', size: 8, distance: 850, speed: 0.003, color: '#bbe1e4' },
    { name: 'Neptune', size: 8, distance: 1000, speed: 0.002, color: '#6081ff' }
];

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true, 
    powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 500, 1200);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2; 
controls.maxDistance = 10000;

// --- POST PROCESSING ---
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.0, // Intense Bloom for the Real Sun
    0.5, 
    0.85
);
composer.addPass(bloomPass);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0x111111, 0.5));
const sunLight = new THREE.PointLight(0xffffff, 3.5, 5000, 1);
sunLight.castShadow = true;
scene.add(sunLight);

// --- THE SUN (REALISTIC SHADER) ---
const sunVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const sunFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform float iTime;
    
    float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        float n = noise(vUv * 8.0 + iTime * 0.05);
        n += noise(vUv * 16.0 - iTime * 0.1) * 0.5;
        
        vec3 color1 = vec3(1.0, 0.3, 0.0); // Surface orange
        vec3 color2 = vec3(1.0, 0.9, 0.1); // Flare yellow
        
        vec3 finalColor = mix(color1, color2, n);
        
        // Edge darkening
        float edge = dot(vNormal, vec3(0,0,1));
        finalColor *= pow(edge, 0.5);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { iTime: { value: 0 } },
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader
});

const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 64), sunMaterial);
scene.add(sun);

// Lens Flare
const textureLoader = new THREE.TextureLoader();
const flareTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png');
const flareMat = new THREE.SpriteMaterial({ 
    map: flareTex, 
    color: 0xffcc00, 
    transparent: true, 
    opacity: 0.6, 
    blending: THREE.AdditiveBlending 
});
const flare = new THREE.Sprite(flareMat);
flare.scale.set(400, 400, 1);
sun.add(flare);

// --- STARS ---
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for(let i=0; i<20000; i++) {
    const r = 5000 + Math.random() * 10000;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2 })));

// --- EARTH ---
let earthGroup;
function createEarth() {
    const group = new THREE.Group();
    
    const mat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(TEXTURE_BASE + 'earth_atmos_2048.jpg'),
        bumpMap: textureLoader.load(TEXTURE_BASE + 'earth_bump_roughness_clouds_4096.jpg'),
        bumpScale: 0.2,
        metalness: 0.1, roughness: 0.8
    });
    
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(5, 128, 128), mat);
    group.add(mesh);
    
    // Clouds
    const cloudMat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(TEXTURE_BASE + 'earth_clouds_1024.png'),
        transparent: true, opacity: 0.4
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(5.05, 128, 128), cloudMat);
    group.add(clouds);
    
    // Atmosphere
    const atmoMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true
    });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(5.2, 128, 128), atmoMat));
    
    return group;
}

const planets = [];
planetsData.forEach(d => {
    const orbit = new THREE.Group();
    scene.add(orbit);
    
    let obj;
    if (d.isEarth) {
        earthGroup = createEarth();
        obj = earthGroup;
    } else {
        const mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.8 });
        obj = new THREE.Mesh(new THREE.SphereGeometry(d.size, 64, 64), mat);
    }
    obj.position.x = d.distance;
    orbit.add(obj);
    
    const curve = new THREE.EllipseCurve(0, 0, d.distance, d.distance);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(150)), new THREE.LineBasicMaterial({ color: 0x333333 }));
    line.rotation.x = Math.PI/2;
    scene.add(line);
    
    planets.push({ orbit, obj, speed: d.speed, name: d.name, distance: d.distance });
});

// --- GOOGLE MAPS TRANSITION ---
let mapInitialized = false;
let map;

function initMap() {
    if (mapInitialized) return;
    map = L.map('map-overlay', { zoomControl: false, attributionControl: false }).setView([20, 0], 2);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(map);
    mapInitialized = true;
}

function updateTransitions() {
    // Check camera distance to Earth
    // We need world position of Earth
    const earthWorldPos = new THREE.Vector3();
    earthGroup.getWorldPosition(earthWorldPos);
    const dist = camera.position.distanceTo(earthWorldPos);
    
    const mapOverlay = document.getElementById('map-overlay');
    const zoomValue = document.getElementById('zoom-value');
    
    if (dist < 40) {
        initMap();
        mapOverlay.style.opacity = '1';
        mapOverlay.style.pointerEvents = 'auto';
        zoomValue.innerText = "Street/House Level";
    } else {
        mapOverlay.style.opacity = '0';
        mapOverlay.style.pointerEvents = 'none';
        zoomValue.innerText = dist > 1000 ? "Outer Space" : "Orbital View";
    }
}

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    sunMaterial.uniforms.iTime.value = time;
    flare.scale.set(400 + Math.sin(time) * 20, 400 + Math.sin(time) * 20, 1);
    
    planets.forEach(p => {
        p.orbit.rotation.y = time * p.speed;
        p.obj.rotation.y += 0.005;
    });
    
    updateTransitions();
    controls.update();
    composer.render();
}

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => document.getElementById('loader').style.display = 'none', 1000);
    }, 2000);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
