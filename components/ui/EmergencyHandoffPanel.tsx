"use client";

import { Clipboard, MapPinned, PhoneCall, Share2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  EMERGENCY_HANDOFF_NOTICE,
  type EmergencyHandoffSummary
} from "@/lib/emergencyHandoff";

interface EmergencyHandoffPanelProps {
  summary: EmergencyHandoffSummary;
  tone?: "dark" | "light";
}

function getPanelClassName(tone: "dark" | "light"): string {
  if (tone === "dark") {
    return "border-white/10 bg-white/[0.04] text-white";
  }

  return "border-ember-200 bg-ember-50 text-smoke-950";
}

function getActionButtonClassName(tone: "dark" | "light"): string {
  if (tone === "dark") {
    return "border-white/10 bg-[#07111f] text-white hover:border-ember-200/70 hover:bg-white/[0.06]";
  }

  return "border-ember-200 bg-white text-smoke-950 hover:border-ember-500 hover:bg-ember-100";
}

export function EmergencyHandoffPanel({
  summary,
  tone = "light"
}: EmergencyHandoffPanelProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copySummary(): Promise<boolean> {
    if (!navigator.clipboard?.writeText) {
      setActionMessage("คัดลอกไม่ได้ในเบราว์เซอร์นี้ กรุณาเลือกข้อความสรุปแล้วคัดลอกเอง");
      return false;
    }

    try {
      await navigator.clipboard.writeText(summary.body);
      setActionMessage("คัดลอกสรุปรายงานแล้ว");
      return true;
    } catch {
      setActionMessage("คัดลอกสรุปรายงานไม่สำเร็จ กรุณาลองใหม่");
      return false;
    }
  }

  async function shareSummary(): Promise<void> {
    if (!canShare) {
      await copySummary();
      return;
    }

    try {
      await navigator.share({
        title: summary.title,
        text: summary.body,
        url: summary.mapsUrl
      });
      setActionMessage("เปิดเมนูแชร์แล้ว");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setActionMessage("แชร์รายงานไม่สำเร็จ จึงคัดลอกสรุปแทน");
      await copySummary();
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${getPanelClassName(tone)}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-current/15 bg-white/10">
          <ShieldAlert aria-hidden="true" size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.16em]">
            Emergency handoff
          </p>
          <h3 className="mt-1 text-xl font-black">เตรียมข้อมูลสำหรับแจ้งเจ้าหน้าที่</h3>
          <p className="mt-2 text-sm leading-6 opacity-80">{EMERGENCY_HANDOFF_NOTICE}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        <a
          className="hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-black text-white hover:bg-red-700"
          href="tel:199"
        >
          <PhoneCall aria-hidden="true" size={16} />
          โทร 199
        </a>
        <button
          className={`hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black ${getActionButtonClassName(tone)}`}
          type="button"
          onClick={() => {
            void copySummary();
          }}
        >
          <Clipboard aria-hidden="true" size={16} />
          คัดลอกสรุป
        </button>
        <button
          className={`hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black ${getActionButtonClassName(tone)}`}
          type="button"
          onClick={() => {
            void shareSummary();
          }}
        >
          <Share2 aria-hidden="true" size={16} />
          {canShare ? "แชร์รายงาน" : "แชร์/คัดลอก"}
        </button>
        <a
          className={`hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black ${getActionButtonClassName(tone)}`}
          href={summary.mapsUrl}
          rel="noreferrer"
          target="_blank"
        >
          <MapPinned aria-hidden="true" size={16} />
          เปิด Maps
        </a>
      </div>

      <details className="mt-4 rounded-md border border-current/10 bg-white/10 p-3">
        <summary className="cursor-pointer text-sm font-black">
          ดูข้อความสรุปสำหรับใช้ประกอบการโทรแจ้งเหตุ
        </summary>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 opacity-80">
          {summary.body}
        </pre>
      </details>

      {actionMessage ? (
        <p aria-live="polite" className="mt-3 text-sm font-semibold opacity-90">
          {actionMessage}
        </p>
      ) : null}
    </div>
  );
}
