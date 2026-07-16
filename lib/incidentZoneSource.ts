import type { AlertZone } from "@/lib/incidentIntelligence";

export type IncidentZoneSource = "server" | "client-fallback" | "local-demo";
export type ServerIncidentZoneStatus =
  | "loading"
  | "not-ready"
  | "ready"
  | "empty"
  | "error";

export interface IncidentZoneSourceSelection {
  source: IncidentZoneSource;
  zones: AlertZone[];
}

export function selectIncidentZoneSource(
  isBackendMode: boolean,
  serverStatus: ServerIncidentZoneStatus,
  serverZones: readonly AlertZone[],
  clientZones: readonly AlertZone[]
): IncidentZoneSourceSelection {
  if (!isBackendMode) {
    return { source: "local-demo", zones: [...clientZones] };
  }
  if (serverStatus === "ready" || serverStatus === "empty") {
    return { source: "server", zones: [...serverZones] };
  }
  return { source: "client-fallback", zones: [...clientZones] };
}

export type PureAliasResolution =
  | { status: "resolved"; canonicalZoneId: string; hops: number }
  | { status: "loop" }
  | { status: "max-hops" };

export function resolveIncidentZoneAliasMap(
  initialZoneId: string,
  aliases: ReadonlyMap<string, string>,
  maximumHops = 8
): PureAliasResolution {
  const visited = new Set<string>();
  let current = initialZoneId;
  for (let hops = 0; hops <= maximumHops; hops += 1) {
    if (visited.has(current)) {
      return { status: "loop" };
    }
    visited.add(current);
    const target = aliases.get(current);
    if (target === undefined) {
      return { status: "resolved", canonicalZoneId: current, hops };
    }
    current = target;
  }
  return { status: "max-hops" };
}

export type IncidentZoneLookupResolution<T> =
  | { status: "found"; canonicalZoneId: string; hops: number; value: T }
  | { status: "missing" | "loop" | "max-hops" };

export async function resolveIncidentZoneWithAliasLookup<T>(
  initialZoneId: string,
  getZone: (zoneId: string) => Promise<T | null>,
  getAliasTarget: (zoneId: string) => Promise<string | null>,
  maximumHops = 8
): Promise<IncidentZoneLookupResolution<T>> {
  const visited = new Set<string>();
  let current = initialZoneId;
  for (let hops = 0; hops <= maximumHops; hops += 1) {
    if (visited.has(current)) {
      return { status: "loop" };
    }
    visited.add(current);

    const zone = await getZone(current);
    if (zone !== null) {
      return {
        status: "found",
        canonicalZoneId: current,
        hops,
        value: zone
      };
    }

    const target = await getAliasTarget(current);
    if (target === null) {
      return { status: "missing" };
    }
    current = target;
  }
  return { status: "max-hops" };
}
