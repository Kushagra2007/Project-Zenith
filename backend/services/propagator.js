import * as satellite from "satellite.js";

// WGS84 Earth Constants for maximum precision
const EARTH_RADIUS_KM = 6378.137;
const MU = 398600.4418; // Standard gravitational parameter (km^3/s^2)
const RAD_TO_DEG = 180 / Math.PI;

export function calculateTelemetry(satelliteRegistry) {
  const now = new Date();
  const payload = [];

  for (const id in satelliteRegistry) {
    const sat = satelliteRegistry[id];
    const satrec = sat.satrec;

    let positionAndVelocity;
    try {
      positionAndVelocity = satellite.propagate(satrec, now);
    } catch (e) {
      continue;
    }

    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    if (positionEci && velocityEci && !isNaN(positionEci.x)) {
      const gmst = satellite.gstime(now);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);

      const latitude = satellite.degreesLat(positionGd.latitude);
      const longitude = satellite.degreesLong(positionGd.longitude);
      const altitude = positionGd.height;

      const velocity = Math.sqrt(
        Math.pow(velocityEci.x, 2) +
          Math.pow(velocityEci.y, 2) +
          Math.pow(velocityEci.z, 2),
      );

      // Deep Keplerian Extraction
      const meanMotionRadPerSec = satrec.no_kozai / 60;
      const semiMajorAxis = Math.pow(
        MU / Math.pow(meanMotionRadPerSec, 2),
        1 / 3,
      );
      const perigee = semiMajorAxis * (1 - satrec.ecco) - EARTH_RADIUS_KM;
      const apogee = semiMajorAxis * (1 + satrec.ecco) - EARTH_RADIUS_KM;
      const periodMins = (2 * Math.PI) / meanMotionRadPerSec / 60;

      payload.push({
        id,
        name: sat.name,
        telemetry: {
          latitude: parseFloat(latitude.toFixed(4)),
          longitude: parseFloat(longitude.toFixed(4)),
          altitude: parseFloat(altitude.toFixed(2)),
          velocity: parseFloat(velocity.toFixed(3)),
        },
        orbitalElements: {
          inclination: (satrec.inclo * RAD_TO_DEG).toFixed(3),
          eccentricity: satrec.ecco.toFixed(6),
          meanMotion: (satrec.no_kozai * (1440 / (2 * Math.PI))).toFixed(3),
          rightAscension: (satrec.nodeo * RAD_TO_DEG).toFixed(3),
          argPerigee: (satrec.argpo * RAD_TO_DEG).toFixed(3),
          meanAnomaly: (satrec.mo * RAD_TO_DEG).toFixed(3),
          bstar: satrec.bstar.toExponential(4),
          perigee: perigee.toFixed(1),
          apogee: apogee.toFixed(1),
          period: periodMins.toFixed(2),
        },
        timestamp: now.toISOString(),
      });
    }
  }
  return payload;
}
