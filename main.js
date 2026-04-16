/**
 * Solaris Elite - Ultra-Realistic NASA Simulation
 */

const scene = new THREE.Scene();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- CONFIGURATION ---
const TEXTURE_BASE = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/";
const planetsData = [
    { name: 'Mercury', size: 2, distance: 100, speed: 0.015, color: '#8c8c8c' },
    { name: 'Venus', size: 4.5, distance: 180, speed: 0.012, color: '#e3bb76' },
    { name: 'Earth', size: 5, distance: 300, speed: 0.01, isEarth: true },
    { name: 'Mars', size: 3.5, distance: 400, speed: 0.008, color: '#cf6140' },
    { name: 'Jupiter', size: 18, distance: 650, speed: 0.005, color: '#d39c7e' },
    { name: 'Saturn', size: 15, distance: 850, speed: 0.004, hasRing: true, color: '#c5ab6e' },
    { name: 'Uranus', size: 10, distance: 1100, speed: 0.003, color: '#bbe1e4' },
    { name: 'Neptune', size: 10, distance: 1400, speed: 0.002, color: '#6081ff' }
];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 800, 1500);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2; 
controls.maxDistance = 15000;

// --- POST PROCESSING ---
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.5, 0.6, 0.85);
composer.addPass(bloomPass);

// --- NASA SUN SIMULATION ---
const sunVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const sunFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float iTime;
    
    // Simplex Noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { 
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i); 
        vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        float noise = snoise(vPosition * 0.05 + iTime * 0.2);
        noise += snoise(vPosition * 0.1 - iTime * 0.1) * 0.5;
        
        vec3 fire = vec3(1.0, 0.4, 0.0);
        vec3 core = vec3(1.0, 1.0, 0.2);
        vec3 color = mix(fire, core, noise + 0.5);
        
        // Dynamic Glow
        float edge = dot(vNormal, vec3(0,0,1));
        color += vec3(1.0, 0.8, 0.1) * pow(1.0 - edge, 3.0);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

const sunMaterial = new THREE.ShaderMaterial({
    uniforms: { iTime: { value: 0 } },
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader
});

const sun = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 64), sunMaterial);
scene.add(sun);

// Sun Point Light
const sunLight = new THREE.PointLight(0xffffff, 4, 10000, 1);
sunLight.castShadow = true;
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x222222));

// --- ASSETS ---
const textureLoader = new THREE.TextureLoader();
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for(let i=0; i<30000; i++) {
    const r = 8000 + Math.random() * 10000;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5 })));

// --- THE EARTH & PLANETS ---
let earthBody;
const planets = [];
planetsData.forEach(d => {
    const orbit = new THREE.Group();
    scene.add(orbit);
    
    let obj;
    if (d.isEarth) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            map: textureLoader.load(TEXTURE_BASE + 'earth_atmos_2048.jpg'),
            bumpMap: textureLoader.load(TEXTURE_BASE + 'earth_normal_2048.jpg'),
            bumpScale: 0.1,
            metalness: 0.1, roughness: 0.9
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(d.size, 128, 128), mat);
        mesh.userData = { id: 'EarthMesh' };
        group.add(mesh);
        
        // Atmosphere Glow
        const atmo = new THREE.Mesh(new THREE.SphereGeometry(d.size + 0.2, 128, 128), new THREE.ShaderMaterial({
            vertexShader: `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec3 vN; void main() { float i = pow(0.7 - dot(vN, vec3(0,0,1)), 3.0); gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * i; }`,
            side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending
        }));
        group.add(atmo);
        
        earthBody = group;
        obj = group;
    } else {
        const mat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.8 });
        obj = new THREE.Mesh(new THREE.SphereGeometry(d.size, 64, 64), mat);
    }
    
    obj.position.x = d.distance;
    orbit.add(obj);
    
    // Orbital path
    const curve = new THREE.EllipseCurve(0, 0, d.distance, d.distance);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(200)), new THREE.LineBasicMaterial({ color: 0x222222 }));
    line.rotation.x = Math.PI/2;
    scene.add(line);
    
    planets.push({ orbit, obj, speed: d.speed, name: d.name });
});

// --- GOOGLE MAPS & SEARCH ENGINE ---
let map;
let mapVisible = false;
let isFollowingEarth = false;

function initMap() {
    if (map) return;
    map = L.map('map-overlay', { zoomControl: true, attributionControl: false }).setView([20, 0], 2);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(map);
}

// Search Functionality
async function searchLocation(query) {
    if(!query) return;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const results = await response.json();
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';
    resultsDiv.style.display = 'block';
    
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerText = res.display_name;
        div.onclick = () => {
            activateMapMode(parseFloat(res.lat), parseFloat(res.lon));
            resultsDiv.style.display = 'none';
        };
        resultsDiv.appendChild(div);
    });
}

function activateMapMode(lat = 20, lon = 0) {
    initMap();
    map.setView([lat, lon], 15);
    document.getElementById('map-overlay').style.opacity = '1';
    document.getElementById('map-overlay').style.pointerEvents = 'auto';
    mapVisible = true;
    isFollowingEarth = true;
    document.getElementById('zoom-value').innerText = "Surface Protocol Active";
}

document.getElementById('search-btn').onclick = () => searchLocation(document.getElementById('place-search').value);
document.getElementById('place-search').onkeypress = (e) => { if(e.key === 'Enter') searchLocation(e.target.value); };

// Click to Earth Detection
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.userData.id === 'EarthMesh') {
            activateMapMode();
            break;
        }
    }
});

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    sunMaterial.uniforms.iTime.value = time;
    
    planets.forEach(p => {
        p.orbit.rotation.y = time * p.speed;
        p.obj.rotation.y += 0.005;
    });

    const earthPos = new THREE.Vector3();
    earthBody.getWorldPosition(earthPos);

    if (isFollowingEarth) {
        controls.target.lerp(earthPos, 0.1);
        const dist = camera.position.distanceTo(earthPos);
        if (dist > 35) {
            const dir = new THREE.Vector3().subVectors(camera.position, earthPos).normalize();
            camera.position.lerp(earthPos.clone().add(dir.multiplyScalar(30)), 0.05);
        }
        // Stop forcing follow once we've arrived close enough
        if (dist < 45) {
            isFollowingEarth = false;
        }
    }

    if (!mapVisible) {
        const dist = camera.position.distanceTo(earthPos);
        if (dist < 40) activateMapMode();
    } else {
        const dist = camera.position.distanceTo(earthPos);
        if (dist > 100 && !isFollowingEarth) {
            document.getElementById('map-overlay').style.opacity = '0';
            document.getElementById('map-overlay').style.pointerEvents = 'none';
            mapVisible = false;
            controls.target.set(0, 0, 0);
        }
    }

    controls.update();
    composer.render();
}

// Window Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => document.getElementById('loader').style.display = 'none', 1000);
    }, 2000);
});

animate();
