"use client";

import { Camera, LocateFixed, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { compressImageToDataUrl } from "@/lib/imageCompression";
import { categoryOptions, severityOptions } from "@/lib/reportLabels";
import type { ReportCategory, ReportDraft, Severity } from "@/lib/types";

interface ReportFormProps {
  onSubmit: (draft: ReportDraft) => void;
}

const defaultLocation = {
  lat: 18.7883,
  lng: 98.9853
};

export function ReportForm({ onSubmit }: ReportFormProps) {
  const [category, setCategory] = useState<ReportCategory>("open_burning");
  const [severity, setSeverity] = useState<Severity>(2);
  const [lat, setLat] = useState(defaultLocation.lat.toString());
  const [lng, setLng] = useState(defaultLocation.lng.toString());
  const [addressLabel, setAddressLabel] = useState("เชียงใหม่");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function requestLocation(): void {
    if (!navigator.geolocation) {
      setFormError("เบราว์เซอร์นี้ไม่รองรับ GPS");
      return;
    }

    setIsLocating(true);
    setFormError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setFormError("อ่านตำแหน่งไม่สำเร็จ");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000
      }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setFormError("ละติจูดไม่ถูกต้อง");
      return;
    }

    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setFormError("ลองจิจูดไม่ถูกต้อง");
      return;
    }

    if (!photoFile) {
      setFormError("ต้องแนบรูปถ่าย");
      return;
    }

    setIsSubmitting(true);

    try {
      const photoURL = await compressImageToDataUrl(photoFile);
      onSubmit({
        lat: parsedLat,
        lng: parsedLng,
        category,
        severity,
        photoURL,
        notes,
        addressLabel
      });
      setNotes("");
      setPhotoFile(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ส่งรายงานไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-smoke-800">
          ประเภทเหตุการณ์
        </label>
        <div className="grid grid-cols-2 gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition ${
                category === option.value
                  ? "border-ember-600 bg-ember-50 text-ember-700"
                  : "border-smoke-200 bg-white text-smoke-700 hover:border-smoke-400"
              }`}
              type="button"
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-smoke-800">
          ความรุนแรง
        </label>
        <div className="grid grid-cols-3 gap-2">
          {severityOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-md border px-3 py-2 text-center text-sm font-semibold transition ${
                severity === option.value
                  ? "border-smoke-950 bg-smoke-950 text-white"
                  : "border-smoke-200 bg-white text-smoke-700 hover:border-smoke-400"
              }`}
              type="button"
              onClick={() => setSeverity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-smoke-800">พื้นที่</span>
          <input
            className="h-11 w-full rounded-md border border-smoke-200 px-3 text-sm outline-none focus:border-smoke-950"
            value={addressLabel}
            onChange={(event) => setAddressLabel(event.target.value)}
            placeholder="เช่น ต.สุเทพ"
          />
        </label>
        <button
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-md border border-smoke-200 bg-white px-3 text-sm font-semibold text-smoke-700 hover:border-smoke-400 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={requestLocation}
          disabled={isLocating}
        >
          <LocateFixed aria-hidden="true" size={18} />
          GPS
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-smoke-800">Lat</span>
          <input
            className="h-11 w-full rounded-md border border-smoke-200 px-3 text-sm outline-none focus:border-smoke-950"
            inputMode="decimal"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-smoke-800">Lng</span>
          <input
            className="h-11 w-full rounded-md border border-smoke-200 px-3 text-sm outline-none focus:border-smoke-950"
            inputMode="decimal"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-smoke-800">รูปถ่าย</span>
        <span className="flex min-h-11 items-center gap-2 rounded-md border border-dashed border-smoke-300 bg-smoke-50 px-3 py-2 text-sm text-smoke-700">
          <Camera aria-hidden="true" size={18} />
          <span className="truncate">{photoFile ? photoFile.name : "เลือกหรือถ่ายรูป"}</span>
        </span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-smoke-800">บันทึกสั้น ๆ</span>
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-smoke-200 px-3 py-2 text-sm outline-none focus:border-smoke-950"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={180}
          placeholder="รายละเอียดที่ช่วยยืนยันเหตุการณ์"
        />
      </label>

      {formError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      ) : null}

      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ember-600 px-4 text-sm font-bold text-white transition hover:bg-ember-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        <Send aria-hidden="true" size={18} />
        {isSubmitting ? "กำลังส่ง" : "ส่งรายงาน"}
      </button>
    </form>
  );
}
