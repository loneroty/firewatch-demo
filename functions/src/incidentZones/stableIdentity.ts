import type {
  IncidentZoneAlias,
  IncidentZoneState
} from "./types";

export interface StableIdentityComponent {
  key: string;
  reportIds: string[];
  anchorReportId: string;
  anchorCreatedAt: number;
}

export interface StableZoneAssignment {
  componentKey: string;
  zoneId: string;
  anchorReportId: string;
  previousZone: IncidentZoneState | null;
}

export interface StableIdentityResult {
  assignments: StableZoneAssignment[];
  aliases: IncidentZoneAlias[];
  mergedZoneCount: number;
  splitZoneCount: number;
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareZonesByAge(a: IncidentZoneState, b: IncidentZoneState): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  return compareText(a.id, b.id);
}

function overlapCount(
  zone: IncidentZoneState,
  component: StableIdentityComponent
): number {
  const componentIds = new Set(component.reportIds);
  return zone.reportIds.reduce(
    (count, reportId) => count + (componentIds.has(reportId) ? 1 : 0),
    0
  );
}

function deterministicSuffix(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function buildNewZoneIdentity(
  component: StableIdentityComponent,
  reservedZoneIds: Set<string>
): { zoneId: string; anchorReportId: string } {
  const baseZoneId = `zone_${component.anchorReportId}`;
  if (!reservedZoneIds.has(baseZoneId)) {
    reservedZoneIds.add(baseZoneId);
    return {
      zoneId: baseZoneId,
      anchorReportId: component.anchorReportId
    };
  }

  const suffixedBase = `${baseZoneId}_${deterministicSuffix(component.key)}`;
  let zoneId = suffixedBase;
  let collisionIndex = 2;
  while (reservedZoneIds.has(zoneId)) {
    zoneId = `${suffixedBase}_${collisionIndex}`;
    collisionIndex += 1;
  }

  reservedZoneIds.add(zoneId);
  return { zoneId, anchorReportId: component.anchorReportId };
}

export function selectCanonicalMergeZone(
  zones: readonly IncidentZoneState[]
): IncidentZoneState {
  const [canonical] = [...zones].sort(compareZonesByAge);
  if (!canonical) {
    throw new Error("At least one previous zone is required for merge selection.");
  }

  return canonical;
}

export function selectSplitRetainedZone(
  previousZone: IncidentZoneState,
  components: readonly StableIdentityComponent[]
): StableIdentityComponent | null {
  const ranked = components
    .map((component) => ({
      component,
      overlap: overlapCount(previousZone, component)
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => {
      if (a.overlap !== b.overlap) {
        return b.overlap - a.overlap;
      }

      if (a.component.anchorCreatedAt !== b.component.anchorCreatedAt) {
        return a.component.anchorCreatedAt - b.component.anchorCreatedAt;
      }

      const anchorDifference = compareText(
        a.component.anchorReportId,
        b.component.anchorReportId
      );
      if (anchorDifference !== 0) {
        return anchorDifference;
      }

      return compareText(a.component.key, b.component.key);
    });

  return ranked[0]?.component ?? null;
}

export function assignStableZoneIds(
  components: readonly StableIdentityComponent[],
  previousZones: readonly IncidentZoneState[],
  now: number,
  algorithmVersion: string
): StableIdentityResult {
  const sortedComponents = [...components].sort((a, b) =>
    compareText(a.key, b.key)
  );
  const reservedZoneIds = new Set(previousZones.map((zone) => zone.id));
  const claimsByComponent = new Map<string, IncidentZoneState[]>();
  let splitZoneCount = 0;

  [...previousZones].sort(compareZonesByAge).forEach((previousZone) => {
    const overlappingComponents = sortedComponents.filter(
      (component) => overlapCount(previousZone, component) > 0
    );
    if (overlappingComponents.length > 1) {
      splitZoneCount += 1;
    }

    const retainedComponent = selectSplitRetainedZone(
      previousZone,
      overlappingComponents
    );
    if (!retainedComponent) {
      return;
    }

    const claims = claimsByComponent.get(retainedComponent.key) ?? [];
    claims.push(previousZone);
    claimsByComponent.set(retainedComponent.key, claims);
  });

  const aliases: IncidentZoneAlias[] = [];
  const assignments = sortedComponents.map((component): StableZoneAssignment => {
    const claims = claimsByComponent.get(component.key) ?? [];
    if (claims.length === 0) {
      const identity = buildNewZoneIdentity(component, reservedZoneIds);
      return {
        componentKey: component.key,
        zoneId: identity.zoneId,
        anchorReportId: identity.anchorReportId,
        previousZone: null
      };
    }

    const canonicalZone = selectCanonicalMergeZone(claims);
    reservedZoneIds.add(canonicalZone.id);
    claims
      .filter((zone) => zone.id !== canonicalZone.id)
      .sort(compareZonesByAge)
      .forEach((zone) => {
        aliases.push({
          oldZoneId: zone.id,
          canonicalZoneId: canonicalZone.id,
          reason: "merged",
          algorithmVersion,
          createdAt: Math.trunc(now)
        });
      });

    return {
      componentKey: component.key,
      zoneId: canonicalZone.id,
      anchorReportId: canonicalZone.anchorReportId,
      previousZone: canonicalZone
    };
  });

  aliases.sort((a, b) => compareText(a.oldZoneId, b.oldZoneId));

  return {
    assignments,
    aliases,
    mergedZoneCount: aliases.length,
    splitZoneCount
  };
}
