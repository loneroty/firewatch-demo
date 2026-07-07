"use client";

import dynamic from "next/dynamic";
import { Camera, LocateFixed, MapPinned, RotateCcw, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
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

const IncidentLocationPicker = dynamic(
  () =>
    import("@/components/map/IncidentLocationPicker").then(
      (module) => module.IncidentLocationPicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[280px] place-items-center rounded-md border border-smoke-200 bg-smoke-100 text-smoke-600 md:h-[320px]">
        กำลังโหลดแผนที่เลือกตำแหน่งเหตุ
      </div>
    )
  }
);

const inputClassName =
  "h-12 w-full rounded-md border border-smoke-200 bg-white px-3 text-sm text-smoke-950 outline-none transition duration-200 placeholder:text-smoke-400 focus:border-ember-600 focus:ring-4 focus:ring-ember-500/10";

function StepHeader({
  description,
  step,
  title
}: {
  description: string;
  step: string;
  title: string;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[44px_1fr]">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-smoke-950 font-mono text-xs font-black text-white">
        {step}
      </span>
      <div>
        <p className="text-base font-black text-smoke-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-smoke-600">{description}</p>
      </div>
    </div>
  );
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function isValidIncidentLocation(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function ReportForm({ onSubmit }: ReportFormProps) {
  const [category, setCategory] = useState<ReportCategory>("open_burning");
  const [severity, setSeverity] = useState<Severity>(2);
  const [lat, setLat] = useState(defaultLocation.lat.toString());
  const [lng, setLng] = useState(defaultLocation.lng.toString());
  const [addressLabel, setAddressLabel] = useState("เชียงใหม่");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lastGpsLocation, setLastGpsLocation] = useState<typeof defaultLocation | null>(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const incidentLocation = useMemo(() => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isValidIncidentLocation(parsedLat, parsedLng)) {
      return {
        lat: parsedLat,
        lng: parsedLng
      };
    }

    return defaultLocation;
  }, [lat, lng]);

  function setIncidentLocation(location: typeof defaultLocation): void {
    setLat(formatCoordinate(location.lat));
    setLng(formatCoordinate(location.lng));
  }

  function requestLocation(): void {
    if (!navigator.geolocation) {
      setFormError("เบราว์เซอร์นี้ไม่รองรับ GPS");
      return;
    }

    setIsLocating(true);
    setFormError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        };
        const accuracy = position.coords.accuracy;

        setIncidentLocation(nextLocation);
        setLastGpsLocation(nextLocation);
        setGpsAccuracyMeters(Number.isFinite(accuracy) ? Math.round(accuracy) : null);
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

  function resetToGpsLocation(): void {
    if (!lastGpsLocation) {
      setFormError("ยังไม่มีตำแหน่ง GPS ล่าสุด ให้กดใช้ GPS ก่อน");
      return;
    }

    setFormError(null);
    setIncidentLocation(lastGpsLocation);
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset className="rounded-lg border border-smoke-200 bg-white p-4 transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_rgb(249_115_22_/_0.08)]">
        <legend className="sr-only">เลือกตำแหน่งเหตุ</legend>
        <StepHeader
          step="01"
          title="เลือกตำแหน่งเหตุ"
          description="GPS ใช้เป็นจุดเริ่มต้นเท่านั้น ให้ลากหมุดไปยังจุดที่เห็นควัน/ไฟก่อนส่งรายงาน"
        />

        <div className="rounded-lg border border-ember-200 bg-ember-50 p-3 text-sm leading-6 text-ember-900">
          <p className="font-black">ตำแหน่งรายงานคือหมุดที่คุณเลือก</p>
          <p className="mt-1">
            ไม่จำเป็นต้องยืนอยู่ตรงจุดไฟ ให้เลื่อนแผนที่ คลิก หรือ ลากหมุดไปยังจุดต้นควัน/ไฟที่เห็น
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-smoke-950">พื้นที่โดยประมาณ</span>
            <input
              className={inputClassName}
              value={addressLabel}
              onChange={(event) => setAddressLabel(event.target.value)}
              placeholder="เช่น ต.สุเทพ หรือใกล้โรงเรียน..."
            />
          </label>
          <button
            className="group hover-lift inline-flex h-12 items-center justify-center gap-2 rounded-md border border-smoke-300 bg-smoke-950 px-4 text-sm font-bold text-white hover:bg-smoke-800 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7"
            type="button"
            onClick={requestLocation}
            disabled={isLocating}
          >
            <LocateFixed aria-hidden="true" className="transition-transform duration-200 group-hover:scale-105" size={18} />
            {isLocating ? "กำลังอ่าน GPS" : "ใช้ GPS เริ่มต้น"}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-smoke-200">
          <IncidentLocationPicker
            lat={incidentLocation.lat}
            lng={incidentLocation.lng}
            onLocationChange={setIncidentLocation}
          />
        </div>

        <div className="mt-3 grid gap-3 rounded-lg border border-smoke-200 bg-smoke-50 p-3 text-sm text-smoke-700 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 font-black text-smoke-950">
              <MapPinned aria-hidden="true" size={16} />
              หมุดเหตุ: {formatCoordinate(incidentLocation.lat)}, {formatCoordinate(incidentLocation.lng)}
            </p>
            {gpsAccuracyMeters !== null ? (
              <p className="mt-1 font-semibold text-smoke-600">
                ความแม่นยำ GPS ประมาณ {gpsAccuracyMeters} เมตร
              </p>
            ) : (
              <p className="mt-1 leading-6">กด GPS เพื่อเริ่มจากตำแหน่งปัจจุบัน หรือปรับหมุดเองได้ทันที</p>
            )}
          </div>
          <button
            className="hover-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-smoke-300 bg-white px-3 py-2 text-sm font-bold text-smoke-700 hover:border-smoke-500 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!lastGpsLocation}
            onClick={resetToGpsLocation}
          >
            <RotateCcw aria-hidden="true" size={15} />
            กลับไป GPS
          </button>
        </div>

        <details className="mt-3 rounded-md border border-smoke-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-black text-smoke-700">
            แก้พิกัด lat/lng เอง
          </summary>
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
        </details>
      </fieldset>

      <fieldset className="rounded-lg border border-smoke-200 bg-white p-4 transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_rgb(249_115_22_/_0.08)]">
        <legend className="sr-only">ระบุประเภทและความรุนแรง</legend>
        <StepHeader
          step="02"
          title="ระบุประเภทและความรุนแรง"
          description="เลือกให้ใกล้เคียงที่สุดเพื่อให้แผนที่ รายการ และ alert zones อ่านสถานการณ์ได้เร็ว"
        />

        <label className="block text-sm font-bold text-smoke-950">ประเภทเหตุการณ์</label>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              className={`hover-lift min-h-12 rounded-md border px-3 py-2 text-left text-sm font-bold ${
                category === option.value
                  ? "border-ember-600 bg-ember-50 text-ember-700 shadow-[inset_4px_0_0_#ea580c,0_10px_26px_rgb(234_88_12_/_0.12)]"
                  : "border-smoke-200 bg-smoke-50 text-smoke-700 hover:border-smoke-400 hover:bg-white"
              }`}
              type="button"
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-bold text-smoke-950">ความรุนแรง</label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {severityOptions.map((option) => (
            <button
              key={option.value}
              className={`hover-lift min-h-12 rounded-md border px-3 py-2 text-center text-sm font-bold ${
                severity === option.value
                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgb(15_23_42_/_0.18)]"
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

      <fieldset className="rounded-lg border border-smoke-200 bg-white p-4 transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_rgb(249_115_22_/_0.08)]">
        <legend className="sr-only">เพิ่มรายละเอียดและแนบรูป</legend>
        <StepHeader
          step="03"
          title="เพิ่มรายละเอียดและแนบรูป"
          description="รูปและข้อความสั้น ๆ ช่วยให้คนอื่นตรวจตำแหน่งและยืนยันรายงานได้ดีขึ้น"
        />

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-smoke-950">บันทึกสั้น ๆ</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-smoke-200 bg-white px-3 py-3 text-sm text-smoke-950 outline-none transition placeholder:text-smoke-400 focus:border-ember-600 focus:ring-4 focus:ring-ember-500/10"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={180}
            placeholder="เช่น เห็นควันจากเชิงดอย ลมพัดเข้าหมู่บ้าน หรือมีเปลวไฟใกล้ถนน"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-2 block text-sm font-bold text-smoke-950">รูปถ่าย</span>
          <span className="group flex min-h-16 items-center gap-3 rounded-md border border-dashed border-smoke-300 bg-smoke-50 px-3 py-3 text-sm text-smoke-700 transition duration-200 hover:-translate-y-0.5 hover:border-ember-500 hover:bg-ember-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-ember-700 shadow-sm transition-transform duration-200 group-hover:scale-105">
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
      </fieldset>

      {formError ? (
        <p className="motion-fade-up rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {formError}
        </p>
      ) : null}

      <div className="rounded-lg border border-ember-200 bg-ember-50 p-4">
        <StepHeader
          step="04"
          title="ส่งรายงาน"
          description="ระบบจะใช้ตำแหน่งหมุดเหตุล่าสุดและตรวจ payload อีกครั้งใน backend mode"
        />
        <button
          className="group hover-lift inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ember-600 px-4 text-sm font-black text-white shadow-[0_14px_30px_rgb(234_88_12_/_0.22)] hover:bg-ember-700 hover:shadow-[0_18px_38px_rgb(234_88_12_/_0.28)] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          <Send aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={18} />
          {isSubmitting ? "กำลังส่งรายงาน" : "ส่งรายงานเข้าสู่ระบบ"}
        </button>
      </div>
    </form>
  );
}
