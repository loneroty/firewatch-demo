const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function assertCoordinate(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90.");
  }

  if (longitude < -180 || longitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180.");
  }
}

export function encodeGeohash(
  latitude: number,
  longitude: number,
  precision = 8
): string {
  assertCoordinate(latitude, longitude);

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bit = 0;
  let charIndex = 0;
  let useLongitude = true;

  while (hash.length < precision) {
    if (useLongitude) {
      const midpoint = (lngMin + lngMax) / 2;
      if (longitude >= midpoint) {
        charIndex = (charIndex << 1) + 1;
        lngMin = midpoint;
      } else {
        charIndex <<= 1;
        lngMax = midpoint;
      }
    } else {
      const midpoint = (latMin + latMax) / 2;
      if (latitude >= midpoint) {
        charIndex = (charIndex << 1) + 1;
        latMin = midpoint;
      } else {
        charIndex <<= 1;
        latMax = midpoint;
      }
    }

    useLongitude = !useLongitude;

    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }

  return hash;
}
