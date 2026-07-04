"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

interface IncidentLocationPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (location: { lat: number; lng: number }) => void;
}

const pickerZoom = 14;

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function createIncidentPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:grid;
        place-items:center;
        width:30px;
        height:30px;
        border-radius:9999px;
        border:3px solid white;
        background:#ea580c;
        box-shadow:0 10px 24px rgba(15,23,42,0.32);
      ">
        <span style="
          width:8px;
          height:8px;
          border-radius:9999px;
          background:white;
          display:block;
        "></span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

export function IncidentLocationPicker({
  lat,
  lng,
  onLocationChange
}: IncidentLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const initialLocationRef = useRef({ lat, lng });
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const initialLocation = initialLocationRef.current;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initialLocation.lat, initialLocation.lng], pickerZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const marker = L.marker([initialLocation.lat, initialLocation.lng], {
      draggable: true,
      icon: createIncidentPinIcon(),
      title: "ตำแหน่งเหตุที่เลือก"
    }).addTo(map);

    function emitLocation(nextLat: number, nextLng: number): void {
      onLocationChangeRef.current({
        lat: roundCoordinate(nextLat),
        lng: roundCoordinate(nextLng)
      });
    }

    map.on("click", (event: L.LeafletMouseEvent) => {
      emitLocation(event.latlng.lat, event.latlng.lng);
    });

    marker.on("dragend", () => {
      const nextLocation = marker.getLatLng();
      emitLocation(nextLocation.lat, nextLocation.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) {
      return;
    }

    const nextLatLng = L.latLng(lat, lng);
    marker.setLatLng(nextLatLng);
    map.panTo(nextLatLng, {
      animate: true,
      duration: 0.25
    });
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      aria-label="แผนที่เลือกตำแหน่งเหตุ"
      className="relative z-0 h-[280px] w-full overflow-hidden rounded-md border border-smoke-200 bg-smoke-100 md:h-[320px]"
    />
  );
}
