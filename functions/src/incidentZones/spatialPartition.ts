import { encodeGeohash } from "../geohash";

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const EARTH_RADIUS_METERS = 6_371_000;

export const INCIDENT_ZONE_PARTITION_PRECISION = 5;
export const MAX_CONNECTED_PARTITIONS = 64;

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeohashBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

function clampLatitude(latitude: number): number {
  return Math.max(-89.999999, Math.min(89.999999, latitude));
}

function normalizeLongitude(longitude: number): number {
  let normalized = longitude;
  while (normalized < -180) {
    normalized += 360;
  }
  while (normalized > 180) {
    normalized -= 360;
  }
  return normalized;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function decodeGeohashBounds(geohash: string): GeohashBounds {
  if (geohash.length === 0) {
    throw new RangeError("A geohash partition key cannot be empty.");
  }

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let useLongitude = true;

  for (const character of geohash.toLowerCase()) {
    const value = GEOHASH_BASE32.indexOf(character);
    if (value < 0) {
      throw new RangeError("A geohash contains an unsupported character.");
    }

    for (let mask = 16; mask > 0; mask >>= 1) {
      if (useLongitude) {
        const midpoint = (lngMin + lngMax) / 2;
        if ((value & mask) !== 0) {
          lngMin = midpoint;
        } else {
          lngMax = midpoint;
        }
      } else {
        const midpoint = (latMin + latMax) / 2;
        if ((value & mask) !== 0) {
          latMin = midpoint;
        } else {
          latMax = midpoint;
        }
      }
      useLongitude = !useLongitude;
    }
  }

  return { latMin, latMax, lngMin, lngMax };
}

export function getIncidentZonePartitionKey(
  coordinate: Coordinate,
  geohash?: string
): string {
  const normalizedGeohash = geohash?.trim().toLowerCase() ?? "";
  if (normalizedGeohash.length >= INCIDENT_ZONE_PARTITION_PRECISION) {
    const prefix = normalizedGeohash.slice(0, INCIDENT_ZONE_PARTITION_PRECISION);
    decodeGeohashBounds(prefix);
    return prefix;
  }

  return encodeGeohash(
    coordinate.lat,
    coordinate.lng,
    INCIDENT_ZONE_PARTITION_PRECISION
  );
}

export function getNeighboringPartitionKeys(partitionKey: string): string[] {
  const normalized = partitionKey.trim().toLowerCase();
  if (normalized.length !== INCIDENT_ZONE_PARTITION_PRECISION) {
    throw new RangeError(
      `Incident-zone partition keys must contain ${INCIDENT_ZONE_PARTITION_PRECISION} characters.`
    );
  }

  const bounds = decodeGeohashBounds(normalized);
  const height = bounds.latMax - bounds.latMin;
  const width = bounds.lngMax - bounds.lngMin;
  const centerLat = (bounds.latMin + bounds.latMax) / 2;
  const centerLng = (bounds.lngMin + bounds.lngMax) / 2;
  const keys = new Set<string>();

  for (const latOffset of [-1, 0, 1]) {
    for (const lngOffset of [-1, 0, 1]) {
      keys.add(
        encodeGeohash(
          clampLatitude(centerLat + latOffset * height),
          normalizeLongitude(centerLng + lngOffset * width),
          INCIDENT_ZONE_PARTITION_PRECISION
        )
      );
    }
  }

  return [...keys].sort();
}

export function getGeohashPrefixRange(partitionKey: string): {
  startAt: string;
  endAt: string;
} {
  const normalized = partitionKey.trim().toLowerCase();
  decodeGeohashBounds(normalized);
  return { startAt: normalized, endAt: `${normalized}\uf8ff` };
}

