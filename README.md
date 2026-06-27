# Project Zenith: The Celestial Eye 
### Powered by the Orbital Resonance Engine

**Submission for Aaruush '26 - AstralWeb Innovate (Round 2)** [cite: 2, 5, 27]

Project Zenith is a highly responsive, GPU-accelerated spatial tracking matrix designed to function as a real-time cosmic radar. Moving beyond static web design, this platform seamlessly ingests bulk telemetry to allow users to select any geographic coordinate on Earth and dynamically visualize the exact celestial bodies (including active satellites and the ISS) passing through that location's zenith in real-time.

## 🌌 Key Features & Deliverables

* **Interactive 3D Geospatial Mapping:** Built on WebGL and Three.js, featuring an interactive 3D globe that captures precise user-selected coordinates via Raycasting.
* **True Zenith Culling Algorithm:** Replaces flawed 2D Mercator approximations with deep Spherical Trigonometry (the Haversine formula) to filter 10,000+ active satellites, displaying only targets actively overhead in the celestial sphere.
* **Real-time Data Synchronization:** Utilizes a custom Node.js/WebSocket bridge to parse Two-Line Elements (TLEs) using the SGP4 propagation model, delivering highly accurate, live celestial data.
* **Responsive, Thematic UI/UX:** A cinematic, glassmorphism-based tactical interface built with advanced CSS (Flexbox/Grid) ensuring cross-device compatibility (mobile, tablet, desktop) and an immersive cosmic theme.
* **Deep Feature Richness:** Interrogates SGP4 state vectors to extract and display raw Keplerian mechanics (Inclination, Eccentricity, Mean Motion, Apogee/Perigee) alongside dynamic velocity trackers.

## 🛠 Tech Stack & Dependencies

* **Frontend:** HTML5, CSS3 (Flexbox), JavaScript (ES6+), Three.js (WebGL rendering), OrbitControls.
* **Backend:** Node.js, Express, `ws` (WebSockets).
* **Physics Engine:** `satellite.js` (for SGP4 orbital propagation).
* **Data Sources / APIs:** Real-time bulk TLE ingestion via Celestrak (No API keys required; endpoints are open and hardcoded into the data pipeline)

## 🚀 Setup & Installation Instructions

Follow these steps to run the application locally:

1. **Clone the repository:**
   ```bash
   git clone (https://github.com/Kushagra2007/Project-Zenith
   cd project-zenith
Install core dependencies:Bash
npm install
Initialize the Server Matrix:Bash
node backend/server.js
Note: The Express server binds to 0.0.0.0 to pierce the WSL2 network barrier, allowing seamless loopback to the host machine. It will immediately begin ingesting active orbital bodies.Access the Interface:

Open your browser and navigate to http://localhost:3000. 

Click "Engage System" to initialize the WebGL rendering environment.

📂 Project Structure/backend - Contains the Node.js server, WebSocket hub, SGP4 propagator.js, and data ingestion configuration./frontend - Contains the index.html structure, CSS styling, Three.js app.js logic, and static textures.README.md - Setup, functionality, and documentation.  
👨‍💻 Author: Kushagra Singh
