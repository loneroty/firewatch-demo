import {
  buildBackendReportPayload,
  buildGsReportImageUrl,
  buildReportImagePath,
  mapCreateReportError,
  readCreateReportCallableResponse
} from "@/lib/firebase/reportPayload";
import type { ReportDraft } from "@/lib/types";

const draft: ReportDraft = {
  lat: 18.7883,
  lng: 98.9853,
  category: "open_burning",
  severity: 2,
  photoURL: "data:image/jpeg;base64,local-preview",
  notes: "Visible smoke",
  addressLabel: "Chiang Mai",
  imageMetadata: {
    contentType: "image/jpeg",
    sizeBytes: 120_000,
    width: 1280,
    height: 960
  }
};

describe("Firebase report payload helpers", () => {
  it("builds a user-owned Storage path and gs URL", () => {
    const path = buildReportImagePath("user-a", "image-1.jpg");

    expect(path).toBe("reportImages/user-a/image-1.jpg");
    expect(buildGsReportImageUrl("firewatch-test.appspot.com", path)).toBe(
      "gs://firewatch-test.appspot.com/reportImages/user-a/image-1.jpg"
    );
  });

  it("rejects unsafe Storage path parts", () => {
    expect(() => buildReportImagePath("user/a", "image-1.jpg")).toThrow(
      "user id"
    );
    expect(() => buildReportImagePath("user-a", "../image.jpg")).toThrow(
      "image id"
    );
  });

  it("builds a backend payload without local-only image data or server fields", () => {
    const payload = buildBackendReportPayload(
      {
        ...draft,
        photoBlob: new Blob(["image"], { type: "image/jpeg" })
      },
      "gs://firewatch-test.appspot.com/reportImages/user-a/image-1.jpg"
    );

    expect(payload).toEqual({
      lat: draft.lat,
      lng: draft.lng,
      category: draft.category,
      severity: draft.severity,
      photoURL: "gs://firewatch-test.appspot.com/reportImages/user-a/image-1.jpg",
      addressLabel: draft.addressLabel,
      notes: draft.notes,
      imageMetadata: draft.imageMetadata
    });
    expect(Object.keys(payload)).not.toContain("photoBlob");
    expect(Object.keys(payload)).not.toContain("userId");
    expect(Object.keys(payload)).not.toContain("createdAt");
    expect(Object.keys(payload)).not.toContain("verificationStatus");
  });

  it("reads callable createReport responses defensively", () => {
    expect(
      readCreateReportCallableResponse({
        reportId: "report-1",
        rateLimit: {
          bucketId: "2026062912",
          count: 1,
          limit: 10
        }
      })
    ).toEqual({
      reportId: "report-1",
      rateLimit: {
        bucketId: "2026062912",
        count: 1,
        limit: 10
      }
    });

    expect(() => readCreateReportCallableResponse({ reportId: 1 })).toThrow(
      "callable createReport"
    );
  });

  it("maps backend and upload errors to readable messages", () => {
    expect(
      mapCreateReportError({
        code: "functions/resource-exhausted",
        message: "Report rate limit exceeded."
      })
    ).toContain("10 ครั้ง");

    expect(
      mapCreateReportError({
        code: "storage/unauthorized",
        message: "User does not have permission."
      })
    ).toContain("อัปโหลดรูปไม่ได้");

    expect(
      mapCreateReportError(
        new Error("ยังไม่ได้ตั้งค่า App Check สำหรับ Firebase backend")
      )
    ).toBe(
      "ยังไม่ได้ตั้งค่า App Check สำหรับ Firebase backend"
    );
  });
});
