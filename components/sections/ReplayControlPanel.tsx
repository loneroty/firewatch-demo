"use client";

import {
  Clock3,
  Eye,
  EyeOff,
  Pause,
  Play,
  Radio,
  RotateCcw
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import type {
  ReplayBucket,
  ReplayChangeSummary,
  ReplayMetrics,
  ReplayMode,
  ReplaySpeed,
  ReplayTimeBounds,
  ReplayWindowKey
} from "@/lib/incidentReplay";

export interface ReplayObservedEvent {
  cursorMs: number;
  riskEscalationCount: number;
  zoneMergeCount: number;
}

interface ReplayControlPanelProps {
  mode: ReplayMode;
  bounds: ReplayTimeBounds | null;
  buckets: readonly ReplayBucket[];
  changeSummary: ReplayChangeSummary | null;
  cursorMs: number;
  heatmapEnabled: boolean;
  metrics: ReplayMetrics;
  observedEvents: readonly ReplayObservedEvent[];
  playing: boolean;
  speed: ReplaySpeed;
  windowKey: ReplayWindowKey;
  onCursorCommit: (cursorMs: number) => void;
  onEnterReplay: () => void;
  onHeatmapEnabledChange: (enabled: boolean) => void;
  onPlayingChange: (playing: boolean) => void;
  onReset: () => void;
  onReturnToLive: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  onWindowChange: (windowKey: ReplayWindowKey) => void;
}

const windowLabels: Readonly<Record<ReplayWindowKey, string>> = {
  "1h": "1 ชั่วโมง",
  "3h": "3 ชั่วโมง",
  "6h": "6 ชั่วโมง",
  "12h": "12 ชั่วโมง",
  "24h": "24 ชั่วโมง",
  all: "ทั้งหมด"
};

const speeds: readonly ReplaySpeed[] = [1, 2, 4];
const windows: readonly ReplayWindowKey[] = [
  "1h",
  "3h",
  "6h",
  "12h",
  "24h",
  "all"
];

function formatReplayDateTime(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    return "ไม่พบเวลา";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(timestampMs));
}

function calculateProgress(
  cursorMs: number,
  bounds: ReplayTimeBounds | null
): number {
  if (!bounds) {
    return 0;
  }
  const duration = bounds.endMs - bounds.startMs;
  if (duration <= 0) {
    return 100;
  }
  return Math.round(
    Math.min(1, Math.max(0, (cursorMs - bounds.startMs) / duration)) * 100
  );
}

function markerPosition(
  timestampMs: number,
  bounds: ReplayTimeBounds
): string {
  const duration = Math.max(1, bounds.endMs - bounds.startMs);
  const progress = Math.min(
    1,
    Math.max(0, (timestampMs - bounds.startMs) / duration)
  );
  return `${progress * 100}%`;
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function ReplayControlPanel({
  mode,
  bounds,
  buckets,
  changeSummary,
  cursorMs,
  heatmapEnabled,
  metrics,
  observedEvents,
  playing,
  speed,
  windowKey,
  onCursorCommit,
  onEnterReplay,
  onHeatmapEnabledChange,
  onPlayingChange,
  onReset,
  onReturnToLive,
  onSpeedChange,
  onWindowChange
}: ReplayControlPanelProps) {
  const sliderMinimum = bounds?.startMs ?? 0;
  const sliderMaximum = bounds?.endMs ?? 1;
  const safeCursor = bounds
    ? Math.min(bounds.endMs, Math.max(bounds.startMs, cursorMs))
    : 0;
  const [draftCursorMs, setDraftCursorMs] = useState(safeCursor);
  const progress = calculateProgress(safeCursor, bounds);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setDraftCursorMs(safeCursor);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [safeCursor]);

  const reportMarkers = useMemo(
    () => buckets.filter((bucket) => bucket.reportCount > 0),
    [buckets]
  );

  function commitDraftCursor(): void {
    if (bounds) {
      onCursorCommit(
        Math.min(bounds.endMs, Math.max(bounds.startMs, draftCursorMs))
      );
    }
  }

  return (
    <Panel className="mb-5 overflow-hidden" padding="none" tone="dark">
      <div className="border-b border-white/10 p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-ember-300">
                Incident replay
              </p>
              <Badge
                className="border-white/10 bg-white/[0.06] text-slate-200"
                tone="neutral"
              >
                {mode === "live" ? "Live" : "Replay"}
              </Badge>
            </div>
            <p className="mt-2 text-xl font-black text-white md:text-2xl">
              ย้อนดูการเปลี่ยนแปลงของรายงานตามเวลา
            </p>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="โหมดแผนที่">
            <Button
              aria-pressed={mode === "live"}
              className="min-h-11"
              size="sm"
              tone={mode === "live" ? "primary" : "dark"}
              onClick={onReturnToLive}
            >
              <Radio aria-hidden="true" size={16} />
              Live
            </Button>
            <Button
              aria-pressed={mode === "replay"}
              className="min-h-11"
              size="sm"
              tone={mode === "replay" ? "primary" : "dark"}
              onClick={onEnterReplay}
            >
              <Clock3 aria-hidden="true" size={16} />
              Replay
            </Button>
            <Button
              aria-pressed={heatmapEnabled}
              className="min-h-11"
              size="sm"
              tone="dark"
              onClick={() => onHeatmapEnabledChange(!heatmapEnabled)}
            >
              {heatmapEnabled ? (
                <Eye aria-hidden="true" size={16} />
              ) : (
                <EyeOff aria-hidden="true" size={16} />
              )}
              Heatmap
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {mode === "live" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-black text-white">สถานการณ์ปัจจุบัน</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                กำลังแสดงสถานการณ์ล่าสุดจากรายงานที่ระบบได้รับ เลือก Replay เพื่อย้อนดูการเปลี่ยนแปลงตามเวลา
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div><p className="text-slate-400">รายงาน</p><p className="mt-1 text-xl font-black text-white">{metrics.reportCount}</p></div>
              <div><p className="text-slate-400">Alert zones</p><p className="mt-1 text-xl font-black text-white">{metrics.alertZoneCount}</p></div>
              <div><p className="text-slate-400">Severity 3</p><p className="mt-1 text-xl font-black text-white">{metrics.severity3Count}</p></div>
              <div><p className="text-slate-400">ยืนยันแล้ว</p><p className="mt-1 text-xl font-black text-white">{metrics.verifiedCount}</p></div>
            </div>
          </div>
        ) : bounds === null ? (
          <div className="space-y-4">
            <label className="block max-w-xs text-sm font-bold text-slate-200">
              ช่วงเวลาย้อนหลัง
              <select
                className="mt-2 min-h-11 w-full rounded-md border border-white/15 bg-[#07111f] px-3 text-white focus:border-ember-400 focus:outline-none focus:ring-2 focus:ring-ember-400/30"
                value={windowKey}
                onChange={(event) =>
                  onWindowChange(event.target.value as ReplayWindowKey)
                }
              >
                {windows.map((window) => (
                  <option key={window} value={window}>{windowLabels[window]}</option>
                ))}
              </select>
            </label>
            <EmptyState
              body="ไม่พบรายงานที่มีเวลาและพิกัดใช้งานได้ในช่วงนี้ เลือกช่วงที่กว้างขึ้นหรือกลับสู่ Live"
              className="min-h-44 border-white/15 bg-white/[0.03]"
              icon={Clock3}
              title="ยังไม่มีข้อมูลสำหรับเล่นย้อนหลัง"
              tone="dark"
            />
            <input
              aria-label="เส้นเวลาเล่นย้อนหลัง ไม่มีข้อมูล"
              className="w-full accent-orange-500"
              disabled
              max={1}
              min={0}
              type="range"
              value={0}
              readOnly
            />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-bold text-slate-200">
                  ช่วงเวลาย้อนหลัง
                  <select
                    className="mt-2 min-h-11 w-full rounded-md border border-white/15 bg-[#07111f] px-3 text-white focus:border-ember-400 focus:outline-none focus:ring-2 focus:ring-ember-400/30"
                    value={windowKey}
                    onChange={(event) =>
                      onWindowChange(event.target.value as ReplayWindowKey)
                    }
                  >
                    {windows.map((window) => (
                      <option key={window} value={window}>{windowLabels[window]}</option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-1 xl:col-span-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Replay cursor
                  </p>
                  <p className="mt-2 break-words text-lg font-black text-white">
                    {formatReplayDateTime(draftCursorMs)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  aria-label={playing ? "หยุดเล่นย้อนหลัง" : "เล่นย้อนหลัง"}
                  className="min-h-11"
                  size="sm"
                  tone="primary"
                  onClick={() => onPlayingChange(!playing)}
                >
                  {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
                  {playing ? "หยุด" : "เล่น"}
                </Button>
                <Button
                  aria-label="ย้อนกลับไปต้นช่วง"
                  className="min-h-11"
                  size="sm"
                  tone="dark"
                  onClick={onReset}
                >
                  <RotateCcw aria-hidden="true" size={16} />
                  เริ่มช่วง
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
                <span>{formatReplayDateTime(bounds.startMs)}</span>
                <span>{progress}%</span>
                <span className="text-right">{formatReplayDateTime(bounds.endMs)}</span>
              </div>
              <div className="relative pt-3">
                <div aria-hidden="true" className="pointer-events-none absolute left-0 right-0 top-0 h-3">
                  {reportMarkers.map((bucket) => (
                    <span
                      key={`report-${bucket.index}`}
                      className={`absolute top-0 h-2 w-1 -translate-x-1/2 rounded-full ${bucket.severity3Count > 0 ? "bg-red-400" : "bg-ember-300"}`}
                      style={{ left: markerPosition(bucket.endMs, bounds) }}
                      title={`${bucket.reportCount} รายงานใหม่`}
                    />
                  ))}
                  {observedEvents.map((event) => (
                    <span
                      key={`event-${event.cursorMs}`}
                      className={`absolute top-0 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-[#07111f] ${event.riskEscalationCount > 0 ? "bg-red-500" : "bg-sky-400"}`}
                      style={{ left: markerPosition(event.cursorMs, bounds) }}
                      title={event.riskEscalationCount > 0 ? "ระดับความเสี่ยงเพิ่ม" : "Zone merge"}
                    />
                  ))}
                </div>
                <input
                  aria-label="เลือกเวลาเล่นย้อนหลัง"
                  className="h-11 w-full cursor-pointer accent-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                  max={sliderMaximum}
                  min={sliderMinimum}
                  step={1}
                  type="range"
                  value={draftCursorMs}
                  onBlur={commitDraftCursor}
                  onChange={(event) => setDraftCursorMs(Number(event.target.value))}
                  onKeyUp={commitDraftCursor}
                  onPointerUp={commitDraftCursor}
                />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span><span className="mr-1 inline-block h-2 w-1 rounded-full bg-ember-300" />รายงานใหม่</span>
                <span><span className="mr-1 inline-block h-2 w-1 rounded-full bg-red-400" />Severity 3</span>
                <span><span className="mr-1 inline-block h-2 w-2 rotate-45 bg-red-500" />Risk เพิ่ม</span>
                <span><span className="mr-1 inline-block h-2 w-2 rotate-45 bg-sky-400" />Zone merge</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-white/10 py-4 sm:grid-cols-4">
              <div><p className="text-xs text-slate-400">รายงาน ณ เวลานี้</p><p className="mt-1 text-2xl font-black text-white">{metrics.reportCount}</p></div>
              <div><p className="text-xs text-slate-400">Alert zones</p><p className="mt-1 text-2xl font-black text-white">{metrics.alertZoneCount}</p></div>
              <div><p className="text-xs text-slate-400">Severity 3</p><p className="mt-1 text-2xl font-black text-white">{metrics.severity3Count}</p></div>
              <div><p className="text-xs text-slate-400">ยืนยันแล้ว</p><p className="mt-1 text-2xl font-black text-white">{metrics.verifiedCount}</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-sm font-black text-white">มีอะไรเปลี่ยนแปลง</p>
                {changeSummary ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-300" aria-live="polite">
                    <span>รายงานใหม่ +{changeSummary.newReportCount}</span>
                    <span>Zone ใหม่ +{changeSummary.newZoneCount}</span>
                    <span>Risk เพิ่ม +{changeSummary.riskEscalationCount}</span>
                    <span>Zone merge +{changeSummary.zoneMergeCount}</span>
                    <span>Severity 3 {formatDelta(changeSummary.severity3Delta)}</span>
                    <span>ยืนยันแล้ว {formatDelta(changeSummary.confirmedDelta)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">เริ่มต้นช่วงเวลา ยังไม่มี frame ก่อนหน้าให้เปรียบเทียบ</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="ความเร็วเล่นย้อนหลัง">
                {speeds.map((candidateSpeed) => (
                  <Button
                    key={candidateSpeed}
                    aria-pressed={speed === candidateSpeed}
                    className="min-h-11 min-w-11"
                    size="sm"
                    tone={speed === candidateSpeed ? "secondary" : "dark"}
                    onClick={() => onSpeedChange(candidateSpeed)}
                  >
                    {candidateSpeed}x
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-1 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">
          <p>การเล่นย้อนหลังเป็นการแสดงข้อมูลรายงานจากชุมชนตามช่วงเวลา ไม่ใช่การจำลองหรือพยากรณ์เหตุฉุกเฉินอย่างเป็นทางการ</p>
          <p>ข้อมูลบางช่วงเวลาอาจไม่ครบถ้วน เนื่องจากขึ้นอยู่กับรายงานที่ระบบได้รับ</p>
        </div>
      </div>
    </Panel>
  );
}
