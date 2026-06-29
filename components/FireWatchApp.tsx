"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, Flame, Gauge, RadioTower } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportForm } from "@/components/ReportForm";
import { ReportList } from "@/components/ReportList";
import { SummaryMetric } from "@/components/SummaryMetric";
import { createReportInBackend } from "@/lib/firebase/reportClient";
import {
  getRuntimeModeLabel,
  isFirebaseBackendConfigured
} from "@/lib/firebase/config";
import {
  getOrCreateLocalUserId,
  loadStoredReports,
  saveStoredReports
} from "@/lib/localReportStore";
import { applyVerificationToReputation, evaluateHourlyRateLimit } from "@/lib/verification/reputation";
import { createLocalReport } from "@/lib/reportFactory";
import { createSeedReports } from "@/lib/seedReports";
import type { Report, ReportDraft, VerificationStatus } from "@/lib/types";

const FireMap = dynamic(
  () => import("@/components/map/FireMap").then((module) => module.FireMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[360px] place-items-center bg-smoke-100 text-smoke-600">
        กำลังโหลดแผนที่
      </div>
    )
  }
);

type StatusFilter = "ทั้งหมด" | VerificationStatus;

const statusFilters: readonly StatusFilter[] = [
  "ทั้งหมด",
  "รอการยืนยัน",
  "ยืนยันแล้ว",
  "ถูกปฏิเสธ"
];

export function FireWatchApp() {
  const isBackendMode = useMemo(() => isFirebaseBackendConfigured(), []);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ทั้งหมด");
  const [localUserId, setLocalUserId] = useState("local-demo-user");
  const [reputationScore, setReputationScore] = useState(35);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      const storedReports = isBackendMode ? createSeedReports() : loadStoredReports();
      setReports(storedReports);
      setSelectedReportId(storedReports[0]?.id ?? null);
      if (!isBackendMode) {
        setLocalUserId(getOrCreateLocalUserId());
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isBackendMode]);

  useEffect(() => {
    if (!isBackendMode && reports.length > 0) {
      saveStoredReports(reports);
    }
  }, [isBackendMode, reports]);

  const visibleReports = useMemo(() => {
    const notHidden = reports.filter((report) => report.moderationStatus !== "ถูกซ่อน");
    if (statusFilter === "ทั้งหมด") {
      return notHidden;
    }

    return notHidden.filter((report) => report.verificationStatus === statusFilter);
  }, [reports, statusFilter]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const confirmedCount = reports.filter(
    (report) => report.verificationStatus === "ยืนยันแล้ว"
  ).length;
  const pendingCount = reports.filter(
    (report) => report.verificationStatus === "รอการยืนยัน"
  ).length;
  const hiddenCount = reports.filter((report) => report.moderationStatus === "ถูกซ่อน").length;

  const handleCreateReport = useCallback(
    async (draft: ReportDraft) => {
      setSystemMessage(null);

      if (isBackendMode) {
        const report = await createReportInBackend(draft);

        setReports((currentReports) => [report, ...currentReports]);
        setSelectedReportId(report.id);
        setSystemMessage("Report sent through Firebase backend.");
        return;
      }

      const now = new Date();
      const rateLimit = evaluateHourlyRateLimit(localUserId, reports, now);

      if (!rateLimit.allowed) {
        setSystemMessage(
          `ส่งรายงานครบ ${rateLimit.limit} ครั้งใน 1 ชั่วโมงแล้ว โปรดลองใหม่ภายหลัง`
        );
        return;
      }

      const report = createLocalReport(
        draft,
        reports,
        localUserId,
        reputationScore,
        now
      );

      setReports((currentReports) => [report, ...currentReports]);
      setSelectedReportId(report.id);
      setReputationScore((currentScore) =>
        applyVerificationToReputation(currentScore, report.verificationStatus)
      );
      setSystemMessage(
        report.verificationStatus === "ยืนยันแล้ว"
          ? "บันทึกรายงานแล้ว และพบรายงานใกล้เคียงที่ช่วยยืนยัน"
          : "บันทึกรายงานแล้ว กำลังรอรายงานใกล้เคียงช่วยยืนยัน"
      );
    },
    [isBackendMode, localUserId, reports, reputationScore]
  );

  const handleFlagReport = useCallback((reportId: string) => {
    setReports((currentReports) =>
      currentReports.map((report) => {
        if (report.id !== reportId) {
          return report;
        }

        const flaggedCount = report.flaggedCount + 1;
        return {
          ...report,
          flaggedCount,
          moderationStatus: flaggedCount >= 3 ? "ถูกซ่อน" : "รอตรวจสอบ"
        };
      })
    );
    setSystemMessage("บันทึกการรายงานความไม่เหมาะสมแล้ว");
  }, []);

  return (
    <main className="min-h-screen bg-smoke-50 text-smoke-950">
      <div className="grid min-h-screen grid-rows-[auto_1fr]">
        <header className="border-b border-smoke-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-smoke-950 text-white">
                <Flame aria-hidden="true" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">FireWatch</h1>
                <p className="text-sm text-smoke-600">
                  รายงานจุดเผาและติดตามความเสี่ยงแบบเรียลไทม์
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-smoke-200 bg-white px-3 py-1 text-smoke-600">
                {getRuntimeModeLabel()}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-canopy-50 px-3 py-1 font-medium text-canopy-700">
                <Gauge aria-hidden="true" size={16} />
                Reputation {reputationScore}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 p-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100vh-96px)]">
            {systemMessage ? (
              <div className="flex items-start gap-3 rounded-lg border border-ember-100 bg-ember-50 p-3 text-sm text-ember-700">
                <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                <span>{systemMessage}</span>
              </div>
            ) : null}

            <section className="rounded-lg border border-smoke-200 bg-white p-4 shadow-panel">
              <div className="mb-4 grid grid-cols-3 gap-2">
                <SummaryMetric label="ทั้งหมด" value={reports.length} icon={RadioTower} />
                <SummaryMetric label="ยืนยันแล้ว" value={confirmedCount} icon={Flame} />
                <SummaryMetric label="รอ" value={pendingCount} icon={AlertTriangle} />
              </div>
              <ReportForm onSubmit={handleCreateReport} />
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-smoke-200 bg-white shadow-panel">
              <div className="border-b border-smoke-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">รายงานล่าสุด</h2>
                  {hiddenCount > 0 ? (
                    <span className="text-xs text-smoke-600">ซ่อน {hiddenCount}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                        statusFilter === filter
                          ? "border-smoke-950 bg-smoke-950 text-white"
                          : "border-smoke-200 bg-white text-smoke-700 hover:border-smoke-400"
                      }`}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <ReportList
                reports={visibleReports}
                selectedReportId={selectedReportId}
                onSelectReport={setSelectedReportId}
                onFlagReport={handleFlagReport}
              />
            </section>
          </aside>

          <section className="min-h-[520px] overflow-hidden rounded-lg border border-smoke-200 bg-white shadow-panel lg:min-h-0">
            <FireMap
              reports={visibleReports}
              selectedReport={selectedReport}
              onSelectReport={setSelectedReportId}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
