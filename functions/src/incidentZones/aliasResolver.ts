import type {
  Firestore,
  Transaction
} from "firebase-admin/firestore";

export const MAX_INCIDENT_ZONE_ALIAS_HOPS = 8;

export type AliasResolutionResult =
  | { status: "resolved"; canonicalZoneId: string; hops: number }
  | { status: "loop"; visitedZoneIds: string[] }
  | { status: "max-hops"; visitedZoneIds: string[] };

export function resolveAliasMap(
  initialZoneId: string,
  aliases: ReadonlyMap<string, string>,
  maximumHops = MAX_INCIDENT_ZONE_ALIAS_HOPS
): AliasResolutionResult {
  const visited = new Set<string>();
  let currentZoneId = initialZoneId;

  for (let hops = 0; hops <= maximumHops; hops += 1) {
    if (visited.has(currentZoneId)) {
      return { status: "loop", visitedZoneIds: [...visited, currentZoneId] };
    }
    visited.add(currentZoneId);

    const target = aliases.get(currentZoneId);
    if (target === undefined) {
      return { status: "resolved", canonicalZoneId: currentZoneId, hops };
    }
    if (target === currentZoneId) {
      return { status: "loop", visitedZoneIds: [...visited, target] };
    }
    currentZoneId = target;
  }

  return { status: "max-hops", visitedZoneIds: [...visited] };
}

function readCanonicalZoneId(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>).canonicalZoneId;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
}

export async function assertAliasWritesSafe(
  db: Firestore,
  transaction: Transaction,
  aliases: readonly Readonly<{
    oldZoneId: string;
    canonicalZoneId: string;
  }>[],
  maximumHops = MAX_INCIDENT_ZONE_ALIAS_HOPS
): Promise<Map<string, string | null>> {
  if (!Number.isInteger(maximumHops) || maximumHops < 1) {
    throw new RangeError("Maximum incident-zone alias hops must be positive.");
  }

  const proposed = new Map(
    aliases.map((alias) => [alias.oldZoneId, alias.canonicalZoneId] as const)
  );
  const existingTargets = new Map<string, string | null>();

  for (const alias of aliases) {
    if (
      alias.oldZoneId.trim().length === 0 ||
      alias.canonicalZoneId.trim().length === 0 ||
      alias.oldZoneId === alias.canonicalZoneId
    ) {
      throw new Error("Incident-zone aliases cannot be empty or self-referential.");
    }

    const aliasSnapshot = await transaction.get(
      db.collection("incidentZoneAliases").doc(alias.oldZoneId)
    );
    const existingTarget = aliasSnapshot.exists
      ? readCanonicalZoneId(aliasSnapshot.data())
      : null;
    existingTargets.set(alias.oldZoneId, existingTarget);
    if (existingTarget !== null && existingTarget !== alias.canonicalZoneId) {
      throw new Error("An existing incident-zone alias cannot be retargeted.");
    }

    const visited = new Set([alias.oldZoneId]);
    let current = alias.canonicalZoneId;
    let hops = 1;
    while (true) {
      if (visited.has(current)) {
        throw new Error("Incident-zone alias update would create a loop.");
      }
      visited.add(current);

      const proposedTarget = proposed.get(current);
      if (proposedTarget !== undefined) {
        if (hops >= maximumHops) {
          throw new Error("Incident-zone alias chain exceeds the maximum hops.");
        }
        current = proposedTarget;
        hops += 1;
        continue;
      }

      const currentSnapshot = await transaction.get(
        db.collection("incidentZoneAliases").doc(current)
      );
      if (!currentSnapshot.exists) {
        break;
      }

      const persistedTarget = readCanonicalZoneId(currentSnapshot.data());
      if (persistedTarget === null) {
        throw new Error("An existing incident-zone alias is malformed.");
      }
      if (hops >= maximumHops) {
        throw new Error("Incident-zone alias chain exceeds the maximum hops.");
      }
      current = persistedTarget;
      hops += 1;
    }
  }

  return existingTargets;
}
