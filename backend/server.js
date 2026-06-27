import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import * as satellite from "satellite.js";

import { TLE_SOURCES } from "./config/constants.js";
import { calculateTelemetry } from "./services/propagator.js";

// Set up directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();

// Tell Express to serve your frontend files to the web
app.use(express.static(path.join(__dirname, "../frontend")));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// This will now hold thousands of dynamically fetched satellites instead of just 10
let satelliteRegistry = {};

/**
 * Bulk TLE Ingestion Engine
 * Fetches and parses massive text files containing all active orbital elements
 */
async function updateTLEData() {
  console.log("Initiating bulk TLE ingestion protocol...");
  let successCount = 0;

  for (const sourceUrl of TLE_SOURCES) {
    try {
        const response = await fetch(sourceUrl);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      // Bulk TLEs come in 3-line chunks (Name, Line 1, Line 2)
      for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length) {
          const name = lines[i].trim();
          const tleLine1 = lines[i + 1].trim();
          const tleLine2 = lines[i + 2].trim();

          // Extract NORAD ID from Line 1 (columns 3-7)
          const noradId = tleLine1.substring(2, 7).trim();

          try {
            const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
            satelliteRegistry[noradId] = { name, satrec };
            successCount++;
          } catch (err) {
            // Silently catch and discard corrupted math records
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching from source ${sourceUrl}:`, error.message);
    }
  }
  console.log(
    `Ingestion complete. Tracking ${successCount} active orbital bodies.`,
  );
}

/**
 * WebSocket Network Hub
 */
wss.on("connection", (ws) => {
  console.log("Frontend dashboard connected.");
  if (Object.keys(satelliteRegistry).length > 0) {
    ws.send(
      JSON.stringify({
        type: "TELEMETRY_UPDATE",
        data: calculateTelemetry(satelliteRegistry),
      }),
    );
  }
});

// Broadcast culled telemetry at 1 Hz
setInterval(() => {
  if (wss.clients.size > 0 && Object.keys(satelliteRegistry).length > 0) {
    const dataBuffer = JSON.stringify({
      type: "TELEMETRY_UPDATE",
      data: calculateTelemetry(satelliteRegistry),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(dataBuffer);
    });
  }
}, 1000);

// Refresh TLEs every 24 hours to account for orbital decay
setInterval(updateTLEData, 24 * 60 * 60 * 1000);

// Bind to 0.0.0.0 for WSL2 Network Bridge
server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Orbital Resonance Engine operating on port: ${PORT}`);
  await updateTLEData();
});
