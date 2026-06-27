// The exact trigger zone for the generative polyphonic chord
export const INDIA_BOUNDS = {
  latMin: 8.4,
  latMax: 37.6,
  lonMin: 68.7,
  lonMax: 97.2,
};

// The expanded visual radar zone (approaching airspace)
// We only transmit data to the frontend if the satellite is within this box
export const RADAR_BOUNDS = {
  latMin: -10.0,
  latMax: 60.0,
  lonMin: 40.0,
  lonMax: 120.0,
};

// Public bulk TLE endpoints (Active Satellites, Starlink, etc.)
export const TLE_SOURCES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle", // 100+ Brightest (ISS, Hubble, etc)
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle", // Active Starlink Constellation
];
