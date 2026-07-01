"use client";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useMemo, useRef } from "react";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report, VerificationStatus } from "@/lib/types";

interface FireMapProps {
  reports: readonly Report[];
  selectedReport: Report | null;
  onSelectReport: (reportId: string) => void;
}

const defaultCenter: L.LatLngExpression = [18.7883, 98.9853];

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

export function FireMap({ reports, selectedReport, onSelectReport }: FireMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

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

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48
    });

    cluster.addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

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

  return <div ref={containerRef} className="h-full min-h-[420px] w-full md:min-h-[560px] lg:min-h-full" />;
}
