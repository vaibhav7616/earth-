/**
 * Celestial 3D - Ultra-Realistic Solar System & Earth Explorer
 */

const scene = new THREE.Scene();
const clock = new THREE.Clock();

// --- CONFIGURATION ---
const TEXTURE_BASE = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/";
const planetsData = [
    { name: 'Mercury', size: 0.8, distance: 40, speed: 0.015, color: '#8c8c8c' },
    { name: 'Venus', size: 1.5, distance: 70, speed: 0.012, color: '#e3bb76' },
    { name: 'Earth', size: 5.0, distance: 130, speed: 0.008, isEarth: true }, // Larger Earth for better focus
    { name: 'Mars', size: 1.2, distance: 180, speed: 0.007, color: '#cf6140' },
    { name: 'Jupiter', size: 12, distance: 280, speed: 0.004, color: '#d39c7e' },
    { name: 'Saturn', size: 10, distance: 380, speed: 0.003, hasRing: true, color: '#c5ab6e' },
    { name: 'Uranus', size: 7, distance: 480, speed: 0.002, color: '#bbe1e4' },
    { name: 'Neptune', size: 7, distance: 550, speed: 0.001, color: '#6081ff' }
];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(0, 300, 800);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2; // Allow very close zoom for Earth
controls.maxDistance = 5000;

// --- POST PROCESSING ---
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
composer.addPass(bloomPass);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0x111111));
const sunLight = new THREE.PointLight(0xffffff, 2.5, 5000, 1.2);
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
    
    // Simple noise fallback for animated surface
    float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = vUv * 10.0;
        float n = noise(uv + iTime * 0.1);
        vec3 color = mix(vec3(1.0, 0.4, 0.0), vec3(1.0, 0.9, 0.2), n);
        
        // Add brightness at center
        float intensity = pow(0.7 - dot(vNormal, vec3(0,0,1)), 2.0);
        color += vec3(1.0, 0.8, 0.1) * intensity;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { iTime: { value: 0 } },
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader
});

const sun = new THREE.Mesh(new THREE.SphereGeometry(25, 64, 64), sunMaterial);
scene.add(sun);

// Sun Flare
const textureLoader = new THREE.TextureLoader();
const flareTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png');
const flareMat = new THREE.SpriteMaterial({ map: flareTex, color: 0xffaa00, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
const flare = new THREE.Sprite(flareMat);
flare.scale.set(200, 200, 1);
sun.add(flare);

// --- STARS ---
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for(let i=0; i<15000; i++) {
    const r = 5000 + Math.random() * 5000;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 })));

// --- EARTH GOOGLE MAPS STYLE ---
let earth;
function createEarth() {
    const group = new THREE.Group();
    
    // High-Res Satellite Texture (ESRI Satellite)
    const satelliteTexture = textureLoader.load('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0'); // Base level
    // Note: To truly "Google Map" it, we would need a tiled implementation. For generic web view, we use a high-res alternative.
    // I will swap textures based on zoom level.
    
    const mat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(TEXTURE_BASE + 'earth_atmos_2048.jpg'),
        bumpMap: textureLoader.load(TEXTURE_BASE + 'earth_bump_roughness_clouds_4096.jpg'),
        bumpScale: 0.05,
        metalness: 0.1, roughness: 0.8
    });
    
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(5, 128, 128), mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    
    // Clouds
    const cloudMat = new THREE.MeshStandardMaterial({
        map: textureLoader.load(TEXTURE_BASE + 'earth_clouds_1024.png'),
        transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(5.05, 128, 128), cloudMat);
    group.add(clouds);
    
    // Atmosphere
    const atmoGeo = new THREE.SphereGeometry(5.2, 128, 128);
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
                float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });
    group.add(new THREE.Mesh(atmoGeo, atmoMat));
    
    return { group, mesh, clouds };
}

const planets = [];
planetsData.forEach(d => {
    const orbit = new THREE.Group();
    scene.add(orbit);
    
    let obj;
    if (d.isEarth) {
        earth = createEarth();
        obj = earth.group;
    } else {
        const mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.8 });
        obj = new THREE.Mesh(new THREE.SphereGeometry(d.size, 64, 64), mat);
    }
    
    obj.position.x = d.distance;
    orbit.add(obj);
    
    // Orbit line
    const curve = new THREE.EllipseCurve(0, 0, d.distance, d.distance);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(100)), new THREE.LineBasicMaterial({ color: 0x444444 }));
    line.rotation.x = Math.PI/2;
    scene.add(line);
    
    planets.push({ orbit, obj, speed: d.speed, name: d.name });
});

// --- GOOGLE MAPS ZOOM TRANSITION ---
// We detect zoom level. If very close to Earth, we reveal a "Satellite View" overlay or high-res texture.
function updateEarthView() {
    const dist = camera.position.distanceTo(earth.group.position);
    // If we are close enough to Earth (e.g. distance < 15)
    if (dist < 20) {
        document.getElementById('map-overlay').style.opacity = '1';
        document.getElementById('map-overlay').style.pointerEvents = 'auto';
    } else {
        document.getElementById('map-overlay').style.opacity = '0';
        document.getElementById('map-overlay').style.pointerEvents = 'none';
    }
}

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    sunMaterial.uniforms.iTime.value = time;
    flare.scale.set(200 + Math.sin(time) * 10, 200 + Math.sin(time) * 10, 1);
    
    planets.forEach(p => {
        p.orbit.rotation.y = time * p.speed;
        p.obj.rotation.y += 0.005;
        if (p.name === 'Earth' && earth.clouds) earth.clouds.rotation.y += 0.001;
    });
    
    updateEarthView();
    controls.update();
    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// Hide loader
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => document.getElementById('loader').style.display = 'none', 1000);
    }, 2000);
});

animate();
