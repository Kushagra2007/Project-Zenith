// Public bulk TLE endpoints (Active Satellites, Starlink, etc.)
// Public bulk TLE endpoints routed through a proxy to bypass datacenter firewalls
const PROXY = "https://api.allorigins.win/raw?url=";

// Public bulk TLE endpoints (URL Encoded to prevent query string stripping)
export const TLE_SOURCES = [
  PROXY +
    encodeURIComponent(
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
    ),
  PROXY +
    encodeURIComponent(
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
    ),
];