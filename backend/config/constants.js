
// Public bulk TLE endpoints (Active Satellites, Starlink, etc.)
// Public bulk TLE endpoints routed through a proxy to bypass datacenter firewalls
export const TLE_SOURCES = [
  "https://api.allorigins.win/raw?url=https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
  "https://api.allorigins.win/raw?url=https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
];