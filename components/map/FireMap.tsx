"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useMemo, useRef } from "react";
import {
  formatZoneAge,
  getAlertZoneOverlayRadiusMeters,
  type AlertZone,
  type RiskLevel
} from "@/lib/incidentIntelligence";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { SmokePlume } from "@/lib/smokePlume";
import type { Report, VerificationStatus } from "@/lib/types";

interface FireMapProps {
  reports: readonly Report[];
  selectedReport: Report | null;
  onSelectReport: (reportId: string) => void;
  alertZones: readonly AlertZone[];
  selectedAlertZoneId: string | null;
  smokePlume: SmokePlume | null;
  onSelectAlertZone: (zoneId: string) => void;
}

const defaultCenter: L.LatLngExpression = [18.7883, 98.9853];

const alertZoneTone: Record<
  RiskLevel,
  {
    color: string;
    fillColor: string;
  }
> = {
  "เฝ้าระวัง": {
    color: "#d97706",
    fillColor: "#f59e0b"
  },
  "น่ากังวล": {
    color: "#ea580c",
    fillColor: "#f97316"
  },
  "ควรตรวจสอบเร่งด่วน": {
    color: "#dc2626",
    fillColor: "#ef4444"
  }
};

const smokePlumeTone: Record<
  RiskLevel,
  {
    color: string;
    fillColor: string;
    fillOpacity: number;
  }
> = {
  "เฝ้าระวัง": {
    color: "#d97706",
    fillColor: "#fbbf24",
    fillOpacity: 0.1
  },
  "น่ากังวล": {
    color: "#ea580c",
    fillColor: "#fb923c",
    fillOpacity: 0.12
  },
  "ควรตรวจสอบเร่งด่วน": {
    color: "#dc2626",
    fillColor: "#f87171",
    fillOpacity: 0.14
  }
};

const statusMarker: Record<
  VerificationStatus,
  {
    markerStatus: "confirmed" | "pending" | "rejected";
    glyph: string;
  }
> = {
  "ยืนยันแล้ว": { markerStatus: "confirmed", glyph: "✓" },
  "รอการยืนยัน": { markerStatus: "pending", glyph: "!" },
  "ถูกปฏิเสธ": { markerStatus: "rejected", glyph: "×" }
};

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function createReportIcon(report: Report): L.DivIcon {
  const marker = statusMarker[report.verificationStatus];
  return L.divIcon({
    className: "",
    html: `<div class="firewatch-marker" data-status="${marker.markerStatus}"><span>${marker.glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function createAlertZonePopup(zone: AlertZone): string {
  return `
    <strong>${escapeHtml(zone.riskLevel)}</strong><br />
    ${escapeHtml(String(zone.reportCount))} รายงาน · ล่าสุด ${escapeHtml(formatZoneAge(zone.latestReportAgeMinutes))}<br />
    Severity สูงสุด ${escapeHtml(String(zone.maxSeverity))}
  `;
}

function getAlertZonePathOptions(
  zone: AlertZone,
  isSelected: boolean
): Omit<L.CircleMarkerOptions, "radius"> {
  const tone = alertZoneTone[zone.riskLevel];

  return {
    color: tone.color,
    fillColor: tone.fillColor,
    fillOpacity: isSelected ? 0.22 : 0.13,
    opacity: isSelected ? 0.9 : 0.58,
    weight: isSelected ? 3 : 2,
    dashArray: isSelected ? undefined : "7 6",
    interactive: true
  };
}

function getSmokePlumePathOptions(plume: SmokePlume): L.PolylineOptions {
  const tone = smokePlumeTone[plume.riskLevel];

  return {
    color: tone.color,
    fillColor: tone.fillColor,
    fillOpacity: tone.fillOpacity,
    opacity: 0.36,
    weight: 2,
    dashArray: "12 10",
    interactive: false,
    bubblingMouseEvents: false,
    smoothFactor: 1.2
  };
}

export function FireMap({
  reports,
  selectedReport,
  onSelectReport,
  alertZones,
  selectedAlertZoneId,
  smokePlume,
  onSelectAlertZone
}: FireMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const plumeLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneCircleRefs = useRef<Map<string, L.Circle>>(new Map());
  const lastFocusedAlertZoneIdRef = useRef<string | null>(null);

  const visibleReports = useMemo(
    () => reports.filter((report) => report.moderationStatus !== "ถูกซ่อน"),
    [reports]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(defaultCenter, 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const plumeLayer = L.layerGroup();
    plumeLayer.addTo(map);

    const zoneLayer = L.layerGroup();
    zoneLayer.addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48
    });

    cluster.addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;
    plumeLayerRef.current = plumeLayer;
    zoneLayerRef.current = zoneLayer;

    const zoneCircleStore = zoneCircleRefs.current;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      plumeLayerRef.current = null;
      zoneLayerRef.current = null;
      zoneCircleStore.clear();
    };
  }, []);

  useEffect(() => {
    const plumeLayer = plumeLayerRef.current;
    if (!plumeLayer) {
      return;
    }

    plumeLayer.clearLayers();
    if (!smokePlume) {
      return;
    }

    const polygon = L.polygon(
      smokePlume.polygon.map((point) => [point.lat, point.lng]),
      getSmokePlumePathOptions(smokePlume)
    );

    polygon.addTo(plumeLayer);
    polygon.bringToBack();
  }, [smokePlume]);

  useEffect(() => {
    const zoneLayer = zoneLayerRef.current;
    if (!zoneLayer) {
      return;
    }

    zoneLayer.clearLayers();
    zoneCircleRefs.current.clear();

    alertZones.forEach((zone) => {
      const isSelected = zone.id === selectedAlertZoneId;
      const circle = L.circle(
        [zone.centerLat, zone.centerLng],
        {
          radius: getAlertZoneOverlayRadiusMeters(zone.reportCount),
          ...getAlertZonePathOptions(zone, isSelected)
        }
      );

      circle.bindPopup(createAlertZonePopup(zone), {
        className: "firewatch-zone-popup",
        maxWidth: 220
      });
      circle.on("click", () => {
        onSelectAlertZone(zone.id);
        circle.openPopup();
      });
      circle.addTo(zoneLayer);
      circle.bringToBack();
      zoneCircleRefs.current.set(zone.id, circle);
    });
  }, [alertZones, onSelectAlertZone, selectedAlertZoneId]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) {
      return;
    }

    cluster.clearLayers();
    visibleReports.forEach((report) => {
      const marker = L.marker([report.lat, report.lng], {
        icon: createReportIcon(report),
        title: `${getCategoryLabel(report.category)} ${report.verificationStatus}`
      });

      const popup = `
        <strong>${escapeHtml(getCategoryLabel(report.category))}</strong><br />
        ${escapeHtml(report.verificationStatus)} · ${escapeHtml(getSeverityLabel(report.severity))}<br />
        ${escapeHtml(report.addressLabel)}
      `;

      marker.bindPopup(popup);
      marker.on("click", () => onSelectReport(report.id));
      cluster.addLayer(marker);
    });
  }, [onSelectReport, visibleReports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedReport) {
      return;
    }

    map.flyTo([selectedReport.lat, selectedReport.lng], Math.max(map.getZoom(), 13), {
      duration: 0.6
    });
  }, [selectedReport]);

  useEffect(() => {
    const map = mapRef.current;

    if (!selectedAlertZoneId) {
      lastFocusedAlertZoneIdRef.current = null;
      return;
    }

    if (!map || lastFocusedAlertZoneIdRef.current === selectedAlertZoneId) {
      return;
    }

    const selectedZone = alertZones.find((zone) => zone.id === selectedAlertZoneId);
    if (!selectedZone) {
      return;
    }

    const targetZoom = Math.min(Math.max(map.getZoom(), 14), 15);

    lastFocusedAlertZoneIdRef.current = selectedAlertZoneId;
    map.flyTo([selectedZone.centerLat, selectedZone.centerLng], targetZoom, {
      duration: 0.55
    });
    zoneCircleRefs.current.get(selectedZone.id)?.openPopup();
  }, [alertZones, selectedAlertZoneId]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 h-full min-h-[420px] w-full md:min-h-[560px] lg:min-h-full"
    />
  );
}
