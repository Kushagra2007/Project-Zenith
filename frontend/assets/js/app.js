// --- 3D SCENE SETUP (THREE.JS) ---
let TARGET_COORD = { lat: 26.22, lon: 81.23 }; // Default
const EARTH_RADIUS = 6371;
const ZENITH_RADIUS_DEG = 8; // Adjust to expand/contract the visibility cone

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

// Tactical Target Cone
const targetGeometry = new THREE.CylinderGeometry(150, 900, 4000, 16, 1, true);
const targetMaterial = new THREE.MeshBasicMaterial({
  color: 0x00f0ff,
  transparent: true,
  opacity: 0.25,
  wireframe: true,
});
const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
scene.add(targetMesh);

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

function updateTargetConePosition() {
  const pos = getCartesian(TARGET_COORD.lat, TARGET_COORD.lon, 2000);
  targetMesh.position.set(pos.x, pos.y, pos.z);
  targetMesh.lookAt(0, 0, 0);
  targetMesh.rotateX(Math.PI / 2);
}
updateTargetConePosition(); // Initial placement

// Particle Matrix
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

// --- RAYCASTER & INTERACTION MECHANICS ---
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 40;
const mouse = new THREE.Vector2();
window.latestTelemetry = [];
window.renderedSatellites = []; // Keeps track of what is currently drawn for inspector mapping

window.addEventListener("click", (event) => {
  if (!geometry.attributes.position) return;

  if (
    event.target.closest("#target-inspector") ||
    event.target.closest("#system-lockout-overlay")
  )
    return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // 1. Check for Map Location Selection First
  const earthIntersects = raycaster.intersectObject(earthMesh);
  if (earthIntersects.length > 0) {
    const point = earthIntersects[0].point;

    // Inverse spatial math to convert Cartesian back to Lat/Lon
    const phi = Math.acos(point.y / EARTH_RADIUS);
    const theta = Math.atan2(point.z, -point.x);

    TARGET_COORD.lat = 90 - phi * (180 / Math.PI);
    TARGET_COORD.lon = theta * (180 / Math.PI) - 180;

    // Normalize longitude wrapping
    if (TARGET_COORD.lon < -180) TARGET_COORD.lon += 360;

    updateTargetConePosition();
    updateDashboard();
    // Immediately force a re-render of the zenith filter with the new coordinates
    if (window.latestTelemetry.length > 0) {
      update3DScene(window.latestTelemetry);
    }
    return;
  }

  // 2. Check for Satellite Selection (Zenith filtered targets only)
  const particleIntersects = raycaster.intersectObject(particles);
  if (particleIntersects.length > 0) {
    const satData = window.renderedSatellites[particleIntersects[0].index];
    if (satData) displayTargetInspector(satData);
  }
});

document.getElementById("close-inspector")?.addEventListener("click", () => {
  document.getElementById("target-inspector")?.classList.add("hidden");
});

function displayTargetInspector(sat) {
  const inspector = document.getElementById("target-inspector");
  if (!inspector) return;

  document.getElementById("inspector-name").textContent = sat.name;
  document.getElementById("inspector-id").textContent = sat.id;
  document.getElementById("inspector-coords").textContent =
    `${sat.telemetry.latitude}°, ${sat.telemetry.longitude}°`;
  document.getElementById("inspector-alt-vel").textContent =
    `${sat.telemetry.altitude} km | ${sat.telemetry.velocity} km/s`;

  if (sat.orbitalElements) {
    document.getElementById("inspector-inc").textContent =
      `${sat.orbitalElements.inclination}°`;
    document.getElementById("inspector-ecc").textContent =
      sat.orbitalElements.eccentricity;
    document.getElementById("inspector-mm").textContent =
      `${sat.orbitalElements.meanMotion} rev/d`;
    document.getElementById("inspector-ra").textContent =
      `${sat.orbitalElements.rightAscension}°`;
    document.getElementById("inspector-arg").textContent =
      `${sat.orbitalElements.argPerigee}°`;
    document.getElementById("inspector-ma").textContent =
      `${sat.orbitalElements.meanAnomaly}°`;
    document.getElementById("inspector-ap").textContent =
      `${sat.orbitalElements.apogee} / ${sat.orbitalElements.perigee} km`;
    document.getElementById("inspector-period").textContent =
      `${sat.orbitalElements.period} min`;
    document.getElementById("inspector-bstar").textContent =
      sat.orbitalElements.bstar;
  }
  inspector.classList.remove("hidden");
}
function getGreatCircleAngle(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLon = (lon2 - lon1) * rad;
  const lat1Rad = lat1 * rad;
  const lat2Rad = lat2 * rad;

  // Haversine formula
  const a =
    Math.pow(Math.sin((lat2Rad - lat1Rad) / 2), 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin(dLon / 2), 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return c * (180 / Math.PI); // Returns actual degrees across the sphere's surface
}
// --- PIPELINE STREAM REFRESH (ZENITH FILTERING) ---
function update3DScene(satellites) {
  window.latestTelemetry = satellites;
  const positions = [];
  window.renderedSatellites = [];

  satellites.forEach((sat) => {
    // Replaced Euclidean flat-math with precise Spherical Haversine calculation
    const angularDistance = getGreatCircleAngle(
      TARGET_COORD.lat,
      TARGET_COORD.lon,
      sat.telemetry.latitude,
      sat.telemetry.longitude,
    );

    // Only render if the satellite is within the angular radius of the zenith cone
    if (angularDistance <= ZENITH_RADIUS_DEG) {
      const coords = getCartesian(
        sat.telemetry.latitude,
        sat.telemetry.longitude,
        sat.telemetry.altitude,
      );
      positions.push(coords.x, coords.y, coords.z);
      window.renderedSatellites.push(sat);
    }
  });

  const positionsArray = new Float32Array(positions);
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positionsArray, 3),
  );

  if (positions.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  geometry.attributes.position.needsUpdate = true;
  updateDashboard();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
// --- DASHBOARD UPDATER ---
function updateDashboard() {
    const coordsSpan = document.getElementById("dash-coords");
    const countSpan = document.getElementById("dash-count");
    const listDiv = document.getElementById("dash-sat-list");

    if (!coordsSpan || !countSpan || !listDiv) return;

    // Update Coordinate Readout
    coordsSpan.textContent = `${TARGET_COORD.lat.toFixed(4)}°, ${TARGET_COORD.lon.toFixed(4)}°`;
    countSpan.textContent = window.renderedSatellites.length;

    if (window.renderedSatellites.length === 0) {
        listDiv.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px; font-size: 0.85rem;">NO TARGETS DETECTED<br>IN ZENITH CONE</div>';
        return;
    }

    // Sort satellites by altitude (lowest to highest)
    const sortedSats = [...window.renderedSatellites].sort((a, b) => a.telemetry.altitude - b.telemetry.altitude);

    let html = '';
    sortedSats.forEach((sat) => {
        html += `
            <div class="dash-sat-item" data-id="${sat.id}">
                <span class="dash-sat-name">${sat.name}</span>
                <span class="dash-sat-alt">${sat.telemetry.altitude.toFixed(0)} km</span>
            </div>
        `;
    });
    listDiv.innerHTML = html;
}

// Enable clicking on dashboard items to open the inspector
document.getElementById("dash-sat-list")?.addEventListener("click", (e) => {
    const item = e.target.closest('.dash-sat-item');
    if (!item) return;
    const satId = item.dataset.id;
    const sat = window.renderedSatellites.find(s => s.id === satId);
    if (sat) displayTargetInspector(sat);
});

// --- CONNECTION INTERFACE ---
const initBtn = document.getElementById("initialize-btn");
if (initBtn) {
  initBtn.addEventListener("click", (event) => {
    event.stopPropagation();

    const overlay = document.getElementById("system-lockout-overlay");
    if (overlay) overlay.style.display = "none";

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
