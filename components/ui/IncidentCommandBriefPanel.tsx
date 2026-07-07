"use client";

import {
  Clipboard,
  ExternalLink,
  FileText,
  Link2,
  Printer,
  QrCode,
  Share2
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  INCIDENT_BRIEF_DISCLAIMER,
  INCIDENT_BRIEF_EMERGENCY_NOTICE,
  type IncidentBrief
} from "@/lib/incidentBrief";

interface IncidentCommandBriefPanelProps {
  brief: IncidentBrief;
  embedded?: boolean;
}

async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function IncidentCommandBriefPanel({
  brief,
  embedded = false
}: IncidentCommandBriefPanelProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    function clearPrintMode(): void {
      document.documentElement.classList.remove("print-incident-brief-only");
    }

    window.addEventListener("afterprint", clearPrintMode);

    return () => {
      window.removeEventListener("afterprint", clearPrintMode);
      clearPrintMode();
    };
  }, []);

  async function copyBrief(): Promise<void> {
    const copied = await writeClipboard(brief.body);
    setActionMessage(
      copied
        ? "คัดลอก Incident Brief แล้ว"
        : "คัดลอกไม่ได้ในเบราว์เซอร์นี้ กรุณาเลือกข้อความ brief แล้วคัดลอกเอง"
    );
  }

  async function copyLink(): Promise<void> {
    const copied = await writeClipboard(brief.shareUrl);
    setActionMessage(
      copied
        ? "คัดลอก handoff link แล้ว"
        : "คัดลอกลิงก์ไม่ได้ในเบราว์เซอร์นี้ กรุณาคัดลอกจากช่องลิงก์"
    );
  }

  async function shareBrief(): Promise<void> {
    if (!canShare) {
      await copyBrief();
      return;
    }

    try {
      await navigator.share({
        title: brief.title,
        text: brief.body,
        url: brief.shareUrl
      });
      setActionMessage("เปิดเมนูแชร์แล้ว");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const copied = await writeClipboard(brief.body);
      setActionMessage(
        copied
          ? "แชร์ไม่สำเร็จ จึงคัดลอก Incident Brief แทน"
          : "แชร์ไม่สำเร็จ และคัดลอกไม่ได้ในเบราว์เซอร์นี้"
      );
    }
  }

  function printBrief(): void {
    document.documentElement.classList.add("print-incident-brief-only");
    window.setTimeout(() => {
      window.print();
    }, 0);
  }

  return (
    <section
      aria-labelledby="incident-command-brief-title"
      className={
        embedded
          ? "text-white"
          : "incident-brief-section bg-[#07111f] px-4 py-12 text-white md:py-14"
      }
    >
      <div className={embedded ? "" : "mx-auto max-w-[1440px]"}>
        <div className="incident-brief-print overflow-hidden rounded-lg border border-white/10 bg-[#0b1728] shadow-[0_24px_80px_rgb(0_0_0_/_0.24)]">
          <div className="border-b border-white/10 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-ember-100">
                  Incident Command Brief
                </p>
                <h2
                  id="incident-command-brief-title"
                  className="mt-2 text-2xl font-black tracking-tight md:text-4xl"
                >
                  FireWatch Incident Brief
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  สรุปเหตุการณ์สำหรับคัดลอก แชร์ พิมพ์ หรือใช้ประกอบการประสานทีมตรวจสอบภาคสนาม
                  โดยไม่ถือเป็นคำสั่งปฏิบัติการทางการ
                </p>
              </div>

              <div
                className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:flex xl:flex-wrap xl:justify-end"
                data-print-hidden="true"
              >
                <button
                  className="hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ember-600 px-3 py-2 text-sm font-black text-white hover:bg-ember-700"
                  type="button"
                  onClick={() => {
                    void copyBrief();
                  }}
                >
                  <Clipboard aria-hidden="true" size={16} />
                  คัดลอก brief
                </button>
                <button
                  className="hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1]"
                  type="button"
                  onClick={() => {
                    void shareBrief();
                  }}
                >
                  <Share2 aria-hidden="true" size={16} />
                  {canShare ? "แชร์ brief" : "แชร์/คัดลอก"}
                </button>
                <button
                  className="hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1]"
                  type="button"
                  onClick={printBrief}
                >
                  <Printer aria-hidden="true" size={16} />
                  พิมพ์/PDF
                </button>
                <a
                  className="hover-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1]"
                  href={brief.mapsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" size={16} />
                  เปิด Maps
                </a>
              </div>
            </div>

            {actionMessage ? (
              <p
                aria-live="polite"
                className="mt-4 rounded-md border border-ember-200/20 bg-ember-200/10 px-3 py-2 text-sm font-semibold text-ember-50"
              >
                {actionMessage}
              </p>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-5 p-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)] lg:p-5">
            <div className="min-w-0 space-y-5">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Target
                  </p>
                  <p className="mt-2 break-words text-base font-black leading-6 text-white">
                    {brief.targetLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {brief.targetKind === "zone" ? "Alert zone" : "Selected report"}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {brief.statusLabel}
                  </p>
                  <p className="mt-2 break-words text-base font-black leading-6 text-ember-100">
                    {brief.statusValue}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Coordinates
                  </p>
                  <p className="mt-2 whitespace-normal break-words font-mono text-sm font-black leading-6 text-white">
                    {brief.coordinateLabel}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Generated
                  </p>
                  <p className="mt-2 break-words text-base font-black leading-6 text-white">
                    {brief.generatedAtLabel}
                  </p>
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-white/10 bg-[#07111f] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-ember-100">
                  <FileText aria-hidden="true" size={17} />
                  Brief sheet
                </div>
                <pre className="max-h-[520px] min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200">
                  {brief.body}
                </pre>
              </div>
            </div>

            <aside className="min-w-0 space-y-4">
              <div className="min-w-0 rounded-lg border border-ember-200/20 bg-ember-200/10 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-ember-50">
                  <QrCode aria-hidden="true" size={17} />
                  QR-ready handoff link
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  รอบนี้ยังไม่สร้าง QR จริงในแอป แต่ลิงก์นี้พร้อมใช้สำหรับส่งต่อหรือใช้สร้าง QR
                  ภายนอกโดยไม่เพิ่ม dependency ใหม่
                </p>
                <div className="mt-3 rounded-md border border-white/10 bg-[#07111f] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Deep link
                  </p>
                  <p className="mt-2 whitespace-normal break-words text-xs leading-5 text-slate-300">
                    {brief.shareUrl}
                  </p>
                </div>
                <div className="mt-3 rounded-md border border-white/10 bg-[#07111f] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Google Maps
                  </p>
                  <p className="mt-2 whitespace-normal break-words text-xs leading-5 text-slate-300">
                    {brief.mapsUrl}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" data-print-hidden="true">
                  <button
                    className="hover-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1]"
                    type="button"
                    onClick={() => {
                      void copyLink();
                    }}
                  >
                    <Link2 aria-hidden="true" size={15} />
                    คัดลอกลิงก์
                  </button>
                  <a
                    className="hover-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1]"
                    href={brief.shareUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" size={15} />
                    เปิดลิงก์
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-black text-white">Safety note</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {INCIDENT_BRIEF_DISCLAIMER}
                </p>
                <p className="mt-2 text-sm font-black leading-6 text-ember-100">
                  {INCIDENT_BRIEF_EMERGENCY_NOTICE}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
