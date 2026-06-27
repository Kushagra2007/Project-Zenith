import * as satellite from "satellite.js";
import { INDIA_BOUNDS, RADAR_BOUNDS } from "../config/constants.js";

export function calculateTelemetry(satelliteRegistry) {
  const now = new Date();
  const payload = [];

  for (const id in satelliteRegistry) {
    const sat = satelliteRegistry[id];
    const satrec = sat.satrec;

    // Skip records that fail to propagate (e.g., decayed orbits)
    let positionAndVelocity;
    try {
      positionAndVelocity = satellite.propagate(satrec, now);
    } catch (e) {
      continue;
    }

    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    // Ensure variables are valid numbers before proceeding
    if (positionEci && velocityEci && !isNaN(positionEci.x)) {
      const gmst = satellite.gstime(now);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);

      const latitude = satellite.degreesLat(positionGd.latitude);
      const longitude = satellite.degreesLong(positionGd.longitude);
      const altitude = positionGd.height;

      // Coarse Filter: Is it inside our expanded RADAR viewing box?
      const isWithinRadar =
        latitude >= RADAR_BOUNDS.latMin &&
        latitude <= RADAR_BOUNDS.latMax &&
        longitude >= RADAR_BOUNDS.lonMin &&
        longitude <= RADAR_BOUNDS.lonMax;

      // If it is nowhere near India, discard it for this frame
      if (!isWithinRadar) continue;

      const velocity = Math.sqrt(
        Math.pow(velocityEci.x, 2) +
          Math.pow(velocityEci.y, 2) +
          Math.pow(velocityEci.z, 2),
      );

      // Fine Filter: Is it actively inside the sonic trigger zone?
      const isOverIndia =
        latitude >= INDIA_BOUNDS.latMin &&
        latitude <= INDIA_BOUNDS.latMax &&
        longitude >= INDIA_BOUNDS.lonMin &&
        longitude <= INDIA_BOUNDS.lonMax;

      // Inside propagator.js, update the payload push:
            payload.push({
                id,
                name: sat.name,
                telemetry: {
                    latitude: parseFloat(latitude.toFixed(4)),
                    longitude: parseFloat(longitude.toFixed(4)),
                    altitude: parseFloat(altitude.toFixed(2)),
                    velocity: parseFloat(velocity.toFixed(3))
                },
                orbitalElements: {
                    // Extracting raw Keplerian elements from the Celestrak satrec object
                    inclination: (satrec.inclo * (180 / Math.PI)).toFixed(2), // Convert rad to deg
                    eccentricity: satrec.ecco.toFixed(6),
                    meanMotion: (satrec.no_kozai * (1440 / (2 * Math.PI))).toFixed(2), // Revs per day
                    bstar: satrec.bstar.toExponential(4) // Drag term
                },
                isOverIndia,
                timestamp: now.toISOString()
            });
    }
  }
  return payload;
}
