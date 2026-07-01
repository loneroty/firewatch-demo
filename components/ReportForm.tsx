"use client";

import { Camera, LocateFixed, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { compressImageForReport } from "@/lib/imageCompression";
import { categoryOptions, severityOptions } from "@/lib/reportLabels";
import type { ReportCategory, ReportDraft, Severity } from "@/lib/types";

interface ReportFormProps {
  onSubmit: (draft: ReportDraft) => Promise<void> | void;
}

const defaultLocation = {
  lat: 18.7883,
  lng: 98.9853
};

const inputClassName =
  "h-12 w-full rounded-md border border-smoke-200 bg-white px-3 text-sm text-smoke-950 outline-none transition placeholder:text-smoke-400 focus:border-ember-600 focus:ring-4 focus:ring-ember-500/10";

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
      const photo = await compressImageForReport(photoFile);
      await onSubmit({
        lat: parsedLat,
        lng: parsedLng,
        category,
        severity,
        photoURL: photo.dataUrl,
        photoBlob: photo.blob,
        imageMetadata: photo.metadata,
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <fieldset className="rounded-md border border-smoke-200 bg-white p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-smoke-500">
          Incident type
        </legend>
        <label className="block text-sm font-bold text-smoke-950">ประเภทเหตุการณ์</label>
        <p className="mt-1 text-sm leading-6 text-smoke-600">
          เลือกประเภทที่ใกล้เคียงที่สุดเพื่อให้แผนที่และรายการอ่านเร็วขึ้น
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              className={`min-h-12 rounded-md border px-3 py-2 text-left text-sm font-bold transition ${
                category === option.value
                  ? "border-ember-600 bg-ember-50 text-ember-700 shadow-[inset_4px_0_0_#ea580c]"
                  : "border-smoke-200 bg-smoke-50 text-smoke-700 hover:border-smoke-400 hover:bg-white"
              }`}
              type="button"
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-smoke-200 bg-white p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-smoke-500">
          Severity
        </legend>
        <label className="block text-sm font-bold text-smoke-950">ความรุนแรง</label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {severityOptions.map((option) => (
            <button
              key={option.value}
              className={`min-h-12 rounded-md border px-3 py-2 text-center text-sm font-bold transition ${
                severity === option.value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-smoke-200 bg-smoke-50 text-smoke-700 hover:border-smoke-400 hover:bg-white"
              }`}
              type="button"
              onClick={() => setSeverity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-smoke-200 bg-white p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-smoke-500">
          Location
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-smoke-950">พื้นที่</span>
            <input
              className={inputClassName}
              value={addressLabel}
              onChange={(event) => setAddressLabel(event.target.value)}
              placeholder="เช่น ต.สุเทพ หรือใกล้โรงเรียน..."
            />
          </label>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-smoke-300 bg-smoke-950 px-4 text-sm font-bold text-white transition hover:bg-smoke-800 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7"
            type="button"
            onClick={requestLocation}
            disabled={isLocating}
          >
            <LocateFixed aria-hidden="true" size={18} />
            {isLocating ? "กำลังอ่าน" : "ใช้ GPS"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-smoke-950">Lat</span>
            <input
              className={inputClassName}
              inputMode="decimal"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-smoke-950">Lng</span>
            <input
              className={inputClassName}
              inputMode="decimal"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-smoke-200 bg-white p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-smoke-500">
          Evidence
        </legend>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-smoke-950">รูปถ่าย</span>
          <span className="flex min-h-16 items-center gap-3 rounded-md border border-dashed border-smoke-300 bg-smoke-50 px-3 py-3 text-sm text-smoke-700 transition hover:border-ember-500 hover:bg-ember-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-ember-700 shadow-sm">
              <Camera aria-hidden="true" size={20} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold">
                {photoFile ? photoFile.name : "เลือกหรือถ่ายรูปจากพื้นที่"}
              </span>
              <span className="mt-1 block text-xs text-smoke-500">
                backend mode จะ upload ไป Storage ก่อนเรียก createReport
              </span>
            </span>
          </span>
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-2 block text-sm font-bold text-smoke-950">บันทึกสั้น ๆ</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-smoke-200 bg-white px-3 py-3 text-sm text-smoke-950 outline-none transition placeholder:text-smoke-400 focus:border-ember-600 focus:ring-4 focus:ring-ember-500/10"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={180}
            placeholder="เช่น เห็นควันจากเชิงดอย ลมพัดเข้าหมู่บ้าน หรือมีเปลวไฟใกล้ถนน"
          />
        </label>
      </fieldset>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {formError}
        </p>
      ) : null}

      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ember-600 px-4 text-sm font-black text-white shadow-[0_14px_30px_rgb(234_88_12_/_0.22)] transition hover:bg-ember-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        <Send aria-hidden="true" size={18} />
        {isSubmitting ? "กำลังส่งรายงาน" : "ส่งรายงานเข้าสู่ระบบ"}
      </button>
    </form>
  );
}
