
// Public bulk TLE endpoints (Active Satellites, Starlink, etc.)
export const TLE_SOURCES = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle", // 100+ Brightest (ISS, Hubble, etc)
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle", // Active Starlink Constellation
];
