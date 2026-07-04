"use client";

import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportForm } from "@/components/ReportForm";
import { ReportList } from "@/components/ReportList";
import { DemoModeSection } from "@/components/sections/DemoModeSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { IncidentIntelligenceSection } from "@/components/sections/IncidentIntelligenceSection";
import { LatestReportsSection } from "@/components/sections/LatestReportsSection";
import { LiveMapSection } from "@/components/sections/LiveMapSection";
import { ReportFormSection } from "@/components/sections/ReportFormSection";
import { SituationSummary } from "@/components/sections/SituationSummary";
import { TopNav } from "@/components/sections/TopNav";
import { TrustSecuritySection } from "@/components/sections/TrustSecuritySection";
import {
  confirmReportInBackend,
  createReportInBackend,
  getBackendSessionUserId
} from "@/lib/firebase/reportClient";
import { subscribeToBackendReports } from "@/lib/firebase/reportStream";
import {
  getRuntimeModeLabel,
  isFirebaseBackendConfigured
} from "@/lib/firebase/config";
import { buildAlertZones } from "@/lib/incidentIntelligence";
import {
  getOrCreateLocalUserId,
  loadStoredReports,
  saveStoredReports
} from "@/lib/localReportStore";
import {
  VERIFICATION_RADIUS_METERS,
  VERIFICATION_WINDOW_MS,
  applyVerificationToReputation,
  evaluateHourlyRateLimit
} from "@/lib/verification/reputation";
import { distanceMeters } from "@/lib/verification/geo";
import { createLocalReport } from "@/lib/reportFactory";
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

function findNearbyOwnedReport(
  targetReport: Report,
  reports: readonly Report[],
  userId: string
): Report | null {
  const targetTime = new Date(targetReport.createdAt).getTime();

  return reports.find((report) => {
    if (report.id === targetReport.id || report.userId !== userId) {
      return false;
    }

    if (
      report.moderationStatus === "ถูกซ่อน" ||
      report.verificationStatus === "ถูกปฏิเสธ"
    ) {
      return false;
    }

    const reportTime = new Date(report.createdAt).getTime();
    const isWithinWindow = Math.abs(targetTime - reportTime) <= VERIFICATION_WINDOW_MS;
    const isWithinRadius = distanceMeters(targetReport, report) <= VERIFICATION_RADIUS_METERS;

    return isWithinWindow && isWithinRadius;
  }) ?? null;
}

export function FireWatchApp() {
  const isBackendMode = useMemo(() => isFirebaseBackendConfigured(), []);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ทั้งหมด");
  const [localUserId, setLocalUserId] = useState("local-demo-user");
  const [reputationScore, setReputationScore] = useState(35);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [selectedAlertZoneId, setSelectedAlertZoneId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      const storedReports = isBackendMode ? [] : loadStoredReports();
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
    if (!isBackendMode) {
      return undefined;
    }

    return subscribeToBackendReports({
      onReports: (nextReports) => {
        setReports(nextReports);
        setSelectedReportId((currentSelectedReportId) => {
          if (
            currentSelectedReportId &&
            nextReports.some((report) => report.id === currentSelectedReportId)
          ) {
            return currentSelectedReportId;
          }

          return nextReports[0]?.id ?? null;
        });
      },
      onError: (message) => {
        setSystemMessage(message);
      }
    });
  }, [isBackendMode]);

  useEffect(() => {
    if (!isBackendMode && reports.length > 0) {
      saveStoredReports(reports);
    }
  }, [isBackendMode, reports]);

  useEffect(() => {
    function updateCurrentTime(): void {
      setCurrentTimeMs(Date.now());
    }

    updateCurrentTime();
    const intervalId = window.setInterval(updateCurrentTime, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
  const recentReportsCount = reports.filter((report) => {
    const createdAt = new Date(report.createdAt).getTime();
    const ageMs = currentTimeMs - createdAt;
    return currentTimeMs > 0 && Number.isFinite(createdAt) && ageMs >= 0 && ageMs <= VERIFICATION_WINDOW_MS;
  }).length;
  const alertZones = useMemo(
    () => buildAlertZones(reports, currentTimeMs > 0 ? new Date(currentTimeMs) : new Date()),
    [currentTimeMs, reports]
  );
  const activeSelectedAlertZoneId = useMemo(
    () =>
      selectedAlertZoneId && alertZones.some((zone) => zone.id === selectedAlertZoneId)
        ? selectedAlertZoneId
        : null,
    [alertZones, selectedAlertZoneId]
  );

  const handleCreateReport = useCallback(
    async (draft: ReportDraft) => {
      setSystemMessage(null);

      if (isBackendMode) {
        const report = await createReportInBackend(draft);

        setSelectedReportId(report.id);
        setSystemMessage("ส่งรายงานผ่าน Firebase backend แล้ว รายงานจะแสดงร่วมกันผ่าน Firestore realtime");
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

  const handleConfirmReport = useCallback(
    async (targetReportId: string) => {
      setSystemMessage(null);

      const targetReport = reports.find((report) => report.id === targetReportId);
      if (!targetReport) {
        setSystemMessage("ไม่พบรายงานที่ต้องการยืนยัน กรุณารีเฟรชแล้วลองใหม่");
        return;
      }

      if (targetReport.moderationStatus === "ถูกซ่อน" || targetReport.verificationStatus === "ถูกปฏิเสธ") {
        setSystemMessage("รายงานนี้ถูกซ่อนหรือถูกปฏิเสธแล้ว จึงยืนยันไม่ได้");
        return;
      }

      if (isBackendMode) {
        try {
          const backendUserId = await getBackendSessionUserId();
          if (targetReport.userId === backendUserId) {
            setSystemMessage("ยืนยันรายงานของตัวเองไม่ได้");
            return;
          }

          const confirmingReport = findNearbyOwnedReport(targetReport, reports, backendUserId);
          if (!confirmingReport) {
            setSystemMessage("ต้องสร้างรายงานใกล้จุดนี้ก่อน จึงจะใช้ยืนยันได้");
            return;
          }

          if (targetReport.confirmedByReportIds.includes(confirmingReport.id)) {
            setSystemMessage("คุณยืนยันจุดนี้แล้ว ไม่สามารถยืนยันซ้ำได้");
            return;
          }

          await confirmReportInBackend(targetReport.id, confirmingReport.id);
          setSelectedReportId(targetReport.id);
          setSystemMessage("ยืนยันจุดนี้สำเร็จ");
        } catch (error) {
          setSystemMessage(getErrorMessage(error));
        }

        return;
      }

      if (targetReport.userId === localUserId) {
        setSystemMessage("ยืนยันรายงานของตัวเองไม่ได้");
        return;
      }

      const confirmingReport = findNearbyOwnedReport(targetReport, reports, localUserId);
      if (!confirmingReport) {
        setSystemMessage("ต้องสร้างรายงานใกล้จุดนี้ก่อน จึงจะใช้ยืนยันได้");
        return;
      }

      if (targetReport.confirmedByReportIds.includes(confirmingReport.id)) {
        setSystemMessage("คุณยืนยันจุดนี้แล้ว ไม่สามารถยืนยันซ้ำได้");
        return;
      }

      setReports((currentReports) =>
        currentReports.map((report) => {
          if (report.id !== targetReport.id) {
            return report;
          }

          return {
            ...report,
            confirmedByReportIds: [...report.confirmedByReportIds, confirmingReport.id],
            verificationStatus: "ยืนยันแล้ว"
          };
        })
      );
      setSelectedReportId(targetReport.id);
      setSystemMessage("ยืนยันจุดนี้สำเร็จใน Local demo mode");
    },
    [isBackendMode, localUserId, reports]
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

  const handleSelectAlertZone = useCallback((zoneId: string) => {
    setSelectedAlertZoneId(zoneId);
  }, []);

  const filterControls = (
    <div className="flex flex-wrap gap-2">
      {statusFilters.map((filter) => (
        <button
          key={filter}
          className={`hover-lift rounded-md border px-3 py-2 text-sm font-bold ${
            statusFilter === filter
              ? "border-slate-950 bg-slate-950 text-white shadow-sm"
              : "border-smoke-200 bg-smoke-50 text-smoke-700 hover:border-smoke-400 hover:bg-white"
          }`}
          type="button"
          onClick={() => setStatusFilter(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f8f5ee] text-smoke-950">
      <TopNav
        runtimeModeLabel={getRuntimeModeLabel()}
        reputationScore={reputationScore}
      />
      <HeroSection
        totalReports={reports.length}
        confirmedCount={confirmedCount}
        pendingCount={pendingCount}
        isBackendMode={isBackendMode}
      />
      <SituationSummary
        totalReports={reports.length}
        pendingCount={pendingCount}
        confirmedCount={confirmedCount}
        recentReportsCount={recentReportsCount}
      />
      <IncidentIntelligenceSection
        zones={alertZones}
        selectedAlertZoneId={activeSelectedAlertZoneId}
        onSelectAlertZone={handleSelectAlertZone}
      />

      {systemMessage ? (
        <div
          aria-live="polite"
          className="motion-fade-up fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-ember-200 bg-[#fffaf3] p-4 text-sm font-semibold text-smoke-950 shadow-[0_22px_60px_rgb(15_23_42_/_0.2)] md:left-auto md:right-6"
          role="status"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-ember-600" size={18} />
          <span>{systemMessage}</span>
        </div>
      ) : null}

      <LiveMapSection>
        <FireMap
          reports={visibleReports}
          selectedReport={selectedReport}
          onSelectReport={setSelectedReportId}
          alertZones={alertZones}
          selectedAlertZoneId={activeSelectedAlertZoneId}
          onSelectAlertZone={handleSelectAlertZone}
        />
      </LiveMapSection>

      <ReportFormSection systemMessage={systemMessage}>
        <ReportForm onSubmit={handleCreateReport} />
      </ReportFormSection>

      <LatestReportsSection hiddenCount={hiddenCount} filters={filterControls}>
        <ReportList
          reports={visibleReports}
          selectedReportId={selectedReportId}
          onSelectReport={setSelectedReportId}
          onFlagReport={handleFlagReport}
          onConfirmReport={handleConfirmReport}
        />
      </LatestReportsSection>

      <HowItWorksSection />
      <TrustSecuritySection />
      <DemoModeSection isBackendMode={isBackendMode} />

      <footer className="bg-[#07111f] px-4 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span>FireWatch civic-tech demo</span>
          <span>Realtime reports, nearby confirmation, and server-side abuse prevention</span>
        </div>
      </footer>
    </main>
  );
}
