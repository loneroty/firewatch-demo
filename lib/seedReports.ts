import type { Report } from "@/lib/types";
import { encodeGeohash } from "@/lib/geohash";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function createSeedReports(): Report[] {
  return [
    {
      id: "seed-chiang-mai-01",
      lat: 18.8087,
      lng: 98.9853,
      geohash: encodeGeohash(18.8087, 98.9853),
      photoURL: "/report-placeholder.svg",
      category: "open_burning",
      severity: 3,
      createdAt: minutesAgo(24),
      userId: "seed-user-a",
      verificationStatus: "ยืนยันแล้ว",
      confirmedByReportIds: ["seed-chiang-mai-02"],
      isThrottled: false,
      flaggedCount: 0,
      moderationStatus: "ปกติ",
      addressLabel: "อ.เมืองเชียงใหม่",
      notes: "ควันหนาแน่นใกล้พื้นที่ชุมชน"
    },
    {
      id: "seed-chiang-mai-02",
      lat: 18.8072,
      lng: 98.9891,
      geohash: encodeGeohash(18.8072, 98.9891),
      photoURL: "/report-placeholder.svg",
      category: "wildfire_smoke",
      severity: 2,
      createdAt: minutesAgo(36),
      userId: "seed-user-b",
      verificationStatus: "ยืนยันแล้ว",
      confirmedByReportIds: ["seed-chiang-mai-01"],
      isThrottled: false,
      flaggedCount: 0,
      moderationStatus: "ปกติ",
      addressLabel: "ใกล้ดอยสุเทพ",
      notes: "เห็นควันต่อเนื่องจากทิศตะวันตก"
    },
    {
      id: "seed-lamphun-01",
      lat: 18.5767,
      lng: 99.0087,
      geohash: encodeGeohash(18.5767, 99.0087),
      photoURL: "/report-placeholder.svg",
      category: "industrial_smoke",
      severity: 1,
      createdAt: minutesAgo(15),
      userId: "seed-user-c",
      verificationStatus: "รอการยืนยัน",
      confirmedByReportIds: [],
      isThrottled: false,
      flaggedCount: 0,
      moderationStatus: "ปกติ",
      addressLabel: "จ.ลำพูน",
      notes: "ต้องการรายงานยืนยันจากผู้ใช้ใกล้เคียง"
    }
  ];
}
