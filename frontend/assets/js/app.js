// --- AUDIO ENGINE ---
let audioCtx = null;
const satelliteAudioEngines = {};
const MAX_POLYPHONY = 6;
const TARGET_COORD = { lat: 26.22, lon: 81.23 }; // Raebareli
const EARTH_RADIUS = 6371;

const SCALE_FREQUENCIES = [
  65.41, 73.42, 78.39, 87.31, 98.0, 130.81, 146.83, 156.79, 174.61, 196.0,
  261.63, 293.66, 313.58, 349.23, 392.0, 523.25, 587.33, 627.17, 698.46, 783.99,
];

function createSatelliteAudioEngine() {
  if (!audioCtx) return null;
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();
  osc.type = "sine";
  filter.type = "lowpass";
  filter.Q.value = 5;
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start();
  return { osc, filter, gainNode };
}

function updateAudioEngine(satId, altitude, velocity, isActive) {
  let engine = satelliteAudioEngines[satId];
  if (!engine) {
    if (!isActive) return;
    engine = createSatelliteAudioEngine();
    if (!engine) return;
    satelliteAudioEngines[satId] = engine;
  }

  if (!isActive) {
    engine.gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
    setTimeout(() => {
      if (satelliteAudioEngines[satId]) {
        engine.osc.stop();
        engine.osc.disconnect();
        delete satelliteAudioEngines[satId];
      }
    }, 1000);
    return;
  }

  const normAlt = Math.max(0, Math.min(1, (altitude - 300) / 300));
  const targetFreq =
    SCALE_FREQUENCIES[Math.floor(normAlt * (SCALE_FREQUENCIES.length - 1))];
  engine.osc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);

  const filterCutoff =
    200 + Math.max(0, Math.min(1, (velocity - 7.4) / 0.4)) * 1200;
  engine.filter.frequency.setTargetAtTime(
    filterCutoff,
    audioCtx.currentTime,
    0.1,
  );
  engine.gainNode.gain.setTargetAtTime(0.1, audioCtx.currentTime, 0.15);
}

// --- 3D SCENE SETUP (THREE.JS) ---
const container = document.getElementById("webgl-container");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  1,
  50000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);

// FIXED: Properly scale the canvas for high-DPI displays without crashing
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

camera.position.set(0, 10000, 18000);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(20000, 15000, 25000);
scene.add(sunLight);

const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({
  color: 0x0a192f,
  specular: new THREE.Color(0x333333),
  shininess: 15,
});
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earthMesh);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  "assets/textures/earth_diffuse.png",
  function (texture) {
    earthMaterial.map = texture;
    earthMaterial.color.setHex(0xffffff);
    earthMaterial.needsUpdate = true;
  },
  undefined,
  function (err) {
    console.warn("Texture lookup failed. Using blue fallback.");
  },
);

const targetGeometry = new THREE.CylinderGeometry(150, 900, 4000, 16, 1, true);
const targetMaterial = new THREE.MeshBasicMaterial({
  color: 0x00f0ff,
  transparent: true,
  opacity: 0.25,
  wireframe: true,
});
const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);

function getCartesian(lat, lon, alt) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const radius = EARTH_RADIUS + alt;
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

const pos = getCartesian(TARGET_COORD.lat, TARGET_COORD.lon, 2000);
targetMesh.position.set(pos.x, pos.y, pos.z);
targetMesh.lookAt(0, 0, 0);
targetMesh.rotateX(Math.PI / 2);
scene.add(targetMesh);

const geometry = new THREE.BufferGeometry();
const material = new THREE.PointsMaterial({
  color: 0x39ff14,
  size: 65,
  transparent: true,
  opacity: 0.75,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const particles = new THREE.Points(geometry, material);
scene.add(particles);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 7500;
controls.maxDistance = 35000;

// --- RAYCASTER TARGET SELECTION MECHANICS ---
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 40;
const mouse = new THREE.Vector2();
window.latestTelemetry = [];

window.addEventListener("click", (event) => {
  // FIXED: Prevent the Raycaster from crashing the entire app if the websocket hasn't delivered data yet
  if (!geometry.attributes.position) return;

  // Ignore clicks on UI elements
  if (
    event.target.closest("#active-voices-panel") ||
    event.target.closest("#target-inspector") ||
    event.target.closest("#audio-lockout-overlay")
  )
    return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(particles);

  if (intersects.length > 0) {
    const satData = window.latestTelemetry[intersects[0].index];
    if (satData) displayTargetInspector(satData);
  }
});

document.getElementById("close-inspector")?.addEventListener("click", () => {
  document.getElementById("target-inspector")?.classList.add("hidden");
});

function displayTargetInspector(sat) {
  const inspector = document.getElementById("target-inspector");
  if (!inspector) return; // Prevent crashes if the HTML is missing

  document.getElementById("inspector-name").textContent = sat.name;
  document.getElementById("inspector-id").textContent = sat.id;
  document.getElementById("inspector-coords").textContent =
    `${sat.telemetry.latitude}°, ${sat.telemetry.longitude}° | ${sat.telemetry.altitude}km`;
  document.getElementById("inspector-vel").textContent =
    `${sat.telemetry.velocity} km/s`;

  if (sat.orbitalElements) {
    document.getElementById("inspector-inc").textContent =
      `${sat.orbitalElements.inclination}°`;
    document.getElementById("inspector-ecc").textContent =
      sat.orbitalElements.eccentricity;
    document.getElementById("inspector-mm").textContent =
      `${sat.orbitalElements.meanMotion} rev/d`;
  } else {
    document.getElementById("inspector-inc").textContent = "PENDING...";
    document.getElementById("inspector-ecc").textContent = "PENDING...";
    document.getElementById("inspector-mm").textContent = "PENDING...";
  }
  inspector.classList.remove("hidden");
}

// --- PIPELINE STREAM REFRESH ---
function update3DScene(satellites) {
  window.latestTelemetry = satellites;

  const positions = new Float32Array(satellites.length * 3);
  satellites.forEach((sat, i) => {
    const coords = getCartesian(
      sat.telemetry.latitude,
      sat.telemetry.longitude,
      sat.telemetry.altitude,
    );
    positions[i * 3] = coords.x;
    positions[i * 3 + 1] = coords.y;
    positions[i * 3 + 2] = coords.z;
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.attributes.position.needsUpdate = true;

  let overpassingSats = satellites
    .filter((s) => s.isOverIndia)
    .map((s) => {
      const dx = s.telemetry.longitude - TARGET_COORD.lon;
      const dy = s.telemetry.latitude - TARGET_COORD.lat;
      return { ...s, dist: Math.sqrt(dx * dx + dy * dy) };
    });

  overpassingSats.sort((a, b) => a.dist - b.dist);
  const activeVoices = overpassingSats.slice(0, MAX_POLYPHONY);
  const sonifiedSatIds = new Set(activeVoices.map((s) => s.id));

  Object.keys(satelliteAudioEngines).forEach((id) => {
    if (!sonifiedSatIds.has(id)) updateAudioEngine(id, 0, 0, false);
  });

  const voiceList = document.getElementById("voice-list");
  if (!voiceList) return;

  if (overpassingSats.length === 0) {
    voiceList.innerHTML =
      '<div class="waiting-notice">AWAITING TARGET OVERPASS...</div>';
  } else {
    let html = "";
    overpassingSats.forEach((sat) => {
      const isSonified = sonifiedSatIds.has(sat.id);
      if (isSonified) {
        updateAudioEngine(
          sat.id,
          sat.telemetry.altitude,
          sat.telemetry.velocity,
          true,
        );
      }
      html += `
                <div class="voice-item ${isSonified ? "" : "overpass-silent"}">
                    <div class="voice-name">${sat.name}</div>
                    <div class="voice-data">ALT: ${sat.telemetry.altitude}km | CHORD: ${isSonified ? "ACTIVE SYNTH" : "SILENT MATRIX"}</div>
                </div>
            `;
    });
    voiceList.innerHTML = html;
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
// FIXED: Explicitly trigger the render loop so it doesn't freeze
animate();

// --- CONNECTION INTERFACE ---
const initBtn = document.getElementById("initialize-btn");
if (initBtn) {
  initBtn.addEventListener("click", (event) => {
    // FIXED: Stop the button click from bubbling to the global window and crashing the Raycaster
    event.stopPropagation();

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const overlay = document.getElementById("audio-lockout-overlay");
    if (overlay) overlay.style.display = "none";

    // FIXED: Restored the full WebSocket connection protocol
    const socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
      const badge = document.getElementById("status-badge");
      if (badge) {
        badge.textContent = "LINK ESTABLISHED";
        badge.className = "badge connected";
      }
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "TELEMETRY_UPDATE") update3DScene(message.data);
    };
  });
}

window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
