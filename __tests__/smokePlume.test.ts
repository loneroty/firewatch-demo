import type { AlertZone } from "@/lib/incidentIntelligence";
import {
  SMOKE_PLUME_DISCLAIMER,
  buildSmokePlume,
  calculateDestinationPoint,
  getPlumeDistanceMeters,
  getWindDirectionLabel,
  type WindSpeedLevel
} from "@/lib/smokePlume";

function makeZone(overrides: Partial<AlertZone> = {}): AlertZone {
  return {
    id: "zone-report-a-report-b",
    reportIds: ["report-a", "report-b"],
    reportCount: 2,
    centerLat: 18.7888,
    centerLng: 98.9858,
    latestReportAt: "2026-06-29T03:00:00.000Z",
    latestReportAgeMinutes: 12,
    maxSeverity: 2,
    averageSeverity: 1.5,
    verifiedReportCount: 1,
    riskLevel: "เฝ้าระวัง",
    riskScore: 4,
    primaryAddressLabel: "เชียงใหม่",
    riskFactors: ["2 รายงานในรัศมี 500 เมตร"],
    ...overrides
  };
}

describe("smoke plume simulation", () => {
  it("returns null when plume is disabled or no alert zone is selected", () => {
    expect(
      buildSmokePlume(makeZone(), {
        enabled: false,
        windDirectionDegrees: 45,
        windSpeedLevel: "ปานกลาง"
      })
    ).toBeNull();

    expect(
      buildSmokePlume(null, {
        enabled: true,
        windDirectionDegrees: 45,
        windSpeedLevel: "ปานกลาง"
      })
    ).toBeNull();
  });

  it("labels smoke movement direction from degrees", () => {
    expect(getWindDirectionLabel(0)).toBe("เหนือ");
    expect(getWindDirectionLabel(45)).toBe("ตะวันออกเฉียงเหนือ");
    expect(getWindDirectionLabel(90)).toBe("ตะวันออก");
    expect(getWindDirectionLabel(180)).toBe("ใต้");
    expect(getWindDirectionLabel(270)).toBe("ตะวันตก");
    expect(getWindDirectionLabel(359)).toBe("เหนือ");
  });

  it("calculates destination points north, east, south, and west within practical tolerance", () => {
    const north = calculateDestinationPoint(0, 0, 0, 1_000);
    const east = calculateDestinationPoint(0, 0, 90, 1_000);
    const south = calculateDestinationPoint(0, 0, 180, 1_000);
    const west = calculateDestinationPoint(0, 0, 270, 1_000);

    expect(north.lat).toBeGreaterThan(0.008);
    expect(Math.abs(north.lng)).toBeLessThan(0.001);
    expect(east.lng).toBeGreaterThan(0.008);
    expect(Math.abs(east.lat)).toBeLessThan(0.001);
    expect(south.lat).toBeLessThan(-0.008);
    expect(Math.abs(south.lng)).toBeLessThan(0.001);
    expect(west.lng).toBeLessThan(-0.008);
    expect(Math.abs(west.lat)).toBeLessThan(0.001);
  });

  it.each<WindSpeedLevel>(["เบา", "ปานกลาง", "แรง"])(
    "builds deterministic plume output for wind speed %s",
    (windSpeedLevel) => {
      const options = {
        enabled: true,
        windDirectionDegrees: 45,
        windSpeedLevel
      };

      expect(buildSmokePlume(makeZone(), options)).toEqual(
        buildSmokePlume(makeZone(), options)
      );
    }
  );

  it("increases plume distance as wind speed increases", () => {
    const light = getPlumeDistanceMeters("น่ากังวล", "เบา");
    const medium = getPlumeDistanceMeters("น่ากังวล", "ปานกลาง");
    const strong = getPlumeDistanceMeters("น่ากังวล", "แรง");

    expect(light).toBeLessThan(medium);
    expect(medium).toBeLessThan(strong);
  });

  it("makes high risk plume longer than low risk with the same wind speed", () => {
    expect(getPlumeDistanceMeters("เฝ้าระวัง", "ปานกลาง")).toBeLessThan(
      getPlumeDistanceMeters("ควรตรวจสอบเร่งด่วน", "ปานกลาง")
    );
  });

  it("builds a bounded five-point plume polygon", () => {
    const plume = buildSmokePlume(makeZone({ riskLevel: "ควรตรวจสอบเร่งด่วน" }), {
      enabled: true,
      windDirectionDegrees: 90,
      windSpeedLevel: "แรง"
    });

    expect(plume?.polygon).toHaveLength(5);
    expect(plume?.lengthMeters).toBeLessThanOrEqual(2_400);
    expect(plume?.widthMeters).toBeLessThanOrEqual(820);
    expect(plume?.polygon.every((point) => Number.isFinite(point.lat))).toBe(true);
    expect(plume?.polygon.every((point) => Number.isFinite(point.lng))).toBe(true);
  });

  it("uses cautious decision-support wording without overclaiming forecast accuracy", () => {
    const plume = buildSmokePlume(makeZone({ riskLevel: "ควรตรวจสอบเร่งด่วน" }), {
      enabled: true,
      windDirectionDegrees: 45,
      windSpeedLevel: "แรง"
    });

    expect(plume?.watchSummary).toContain("ควร");
    expect(plume?.watchSummary).toContain("ช่วยประเมินเบื้องต้น");
    expect(plume?.watchSummary).not.toContain("คาดการณ์แม่นยำ");
    expect(plume?.watchSummary).not.toContain("ระบบทำนาย");
    expect(plume?.watchSummary).not.toContain("ยืนยันแนวควันจริง");
    expect(plume?.disclaimer).toBe(SMOKE_PLUME_DISCLAIMER);
    expect(SMOKE_PLUME_DISCLAIMER).toContain("ไม่ใช่การพยากรณ์ควันจริง");
  });
});
