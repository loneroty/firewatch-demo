# Prompt สำหรับวางใน Codex — FireWatch (God Mode: production-grade เต็มรูป)

> เวอร์ชันนี้แทนที่ไฟล์เดิมทั้งหมด ใช้คู่กับ `AGENTS.md` (god mode) ที่ root — ไฟล์นั้นคือกฎที่ Codex ต้องอ่านทุกครั้ง ไฟล์นี้คือสเปกฟีเจอร์/โครงสร้างที่ต้องสร้าง
>
> วิธีใช้: ก็อปทั้งหมดตั้งแต่ "เริ่ม Prompt ตรงนี้" วางใน Codex ถ้าทำทีเดียวไม่ครบ แบ่งตาม Roadmap ท้ายไฟล์

---

## เริ่ม Prompt ตรงนี้

สร้างแอป "FireWatch" — แพลตฟอร์ม crowdsource รายงาน/ปักหมุดจุดเผา แสดงแผนที่ความเสี่ยงเรียลไทม์ เตือนคนใกล้เคียง ส่งสรุปให้หน่วยงานท้องถิ่น **ต้องสร้างด้วยมาตรฐานระดับ production จริง ไม่ใช่ของเล่นสำหรับ demo** — มี CI/CD, automated testing, security testing, observability ครบตามที่ระบุ

อ่านและปฏิบัติตาม `AGENTS.md` ที่ root อย่างเคร่งครัดทุกขั้นตอน ห้ามข้ามกฎเหล็กในนั้นไม่ว่ากรณีใด

### Tech Stack
Next.js (App Router) + TypeScript (`strict: true`, ห้าม `any`) + Tailwind CSS + PWA (`@ducanh2912/next-pwa`) + Leaflet.js + `leaflet.markercluster` + Firebase (Firestore, Storage, Cloud Functions, Cloud Messaging, App Check, Remote Config) + Line Login + Vercel + Sentry + Firebase Performance Monitoring + Jest + `@firebase/rules-unit-testing` + Playwright + Lighthouse CI

### Responsive Design
- มือถือ (<768px): แผนที่เต็มจอ, ปุ่มรายงานลอยมุมขวาล่าง, bottom navigation
- Desktop (≥1024px): 2 คอลัมน์ (panel รายการ/filter ฝั่งซ้าย + แผนที่ฝั่งขวา)

### Data Model (Firestore)
```
reports: {
  id, lat, lng, geohash, photoURL, category, severity,
  createdAt, userId,
  verificationStatus: "รอการยืนยัน" | "ยืนยันแล้ว" | "ถูกปฏิเสธ",
  confirmedByReportIds: string[], isThrottled: boolean,
  flaggedCount: number, moderationStatus: "ปกติ" | "ถูกซ่อน" | "รอตรวจสอบ"
}
users: {
  id, authProvider, displayName, reputationScore,
  reportsCount, verifiedReportsCount, rejectedReportsCount,
  homeGeohash, isSuspended, createdAt
}
admins: { uid, role: "moderator" | "superadmin" }
```

### ฟีเจอร์หลัก
1. **Auth:** Line Login หลัก + Phone Auth fallback, ขอ permission ตำแหน่ง/กล้องแบบอธิบายเหตุผลก่อนขอจริง
2. **หน้ารายงาน:** ถ่ายรูปสดบังคับ + GPS auto + เลือกหมวด/ความรุนแรง ≤3 แตะ, บีบอัดรูป <500KB ก่อนอัปโหลด
3. **แผนที่:** real-time, marker clustering, สีหมุดตามสถานะ **+ ไอคอน/รูปทรงต่างกันต่อสถานะ** (ไม่ใช้สีอย่างเดียว เพื่อรองรับผู้ใช้ตาบอดสี)
4. **ตรรกะยืนยันร่วม + Reputation Score:** cross-validation รัศมี 500m/60นาที, +5/-15 คะแนน, throttle คะแนน<20 — เขียนเป็น Cloud Function พร้อม unit test ครอบคลุม edge case (เช่น report พร้อมกันเป๊ะ, รัศมีติดขอบ 500m)
5. **Rate Limiting:** Cloud Function reject ถ้า user ส่ง report เกิน 10 ครั้ง/ชั่วโมง + Firebase App Check บังคับทุก request
6. **Content Moderation:** ปุ่มรายงานไม่เหมาะสม, ซ่อนอัตโนมัติเมื่อ `flaggedCount` ≥ 3, หน้า Admin ตรวจสอบ/คืนสถานะได้
7. **Admin Dashboard:** เข้าได้เฉพาะ uid ใน `admins` (เช็คผ่าน Security Rules ไม่ใช่ client-side check อย่างเดียว), ยืนยัน/ปฏิเสธ/ระงับผู้ใช้/export CSV
8. **Push Notification:** Web Push ผ่าน FCM ตาม `homeGeohash` zone, ทำงานแม้ปิดแอป
9. **Privacy Policy + Terms of Service:** หน้าจริง สอดคล้อง PDPA — อธิบายข้อมูลที่เก็บ วัตถุประสงค์ ระยะเก็บ วิธีขอลบข้อมูล
10. **Feature Flags:** ใช้ Firebase Remote Config คุมการเปิดฟีเจอร์ใหม่แบบค่อยเป็นค่อยไป

### Security Rules + Testing (บังคับ)
เขียน `firestore.rules`:
```
reports: read = public, write = ต้อง login และ userId ตรงกับ auth.uid
users: read/write = เฉพาะเจ้าของ document หรือ admin
admins: read = เฉพาะตัวเอง, write = ปิดจาก client ทั้งหมด
```
เขียน `firestore.rules.test.ts` ด้วย `@firebase/rules-unit-testing` ทดสอบ: คนไม่ login เขียนไม่ได้, user แก้ของคนอื่นไม่ได้, เฉพาะ admin เข้าถึง admin-only field ได้ — รันใน CI ก่อน deploy rules ทุกครั้ง

### CI/CD (`.github/workflows/ci.yml`)
ทุก PR: install → lint → typecheck → unit test (รวม rules test) → build → Lighthouse CI (Performance/Accessibility/Best Practices ≥ 90, PWA installable ผ่าน) → deploy preview Vercel
Merge เข้า `main`: deploy production อัตโนมัติ + deploy security rules แยกขั้นตอนหลัง test ผ่านเท่านั้น

### Observability
`lib/logger.ts` wrapper เดียวสำหรับ log ทั้งหมด (ห้าม `console.log` ดิบในที่อื่น) + ส่ง error เข้า Sentry พร้อม context + Firebase Performance Monitoring วัด loading time จริง

### Accessibility
ทุกรูปมี alt text, ปุ่ม/control บนแผนที่กด tab navigate ได้, contrast สีตามเกณฑ์ WCAG AA, หมุดแยกแยะได้ไม่ใช่ด้วยสีอย่างเดียว

### สิ่งที่ไม่ต้องทำ
ML/AI พยากรณ์ใดๆ, แอป native แยก, เชื่อม API หน่วยงานราชการจริง (ใช้ export CSV แทน)

### Acceptance Criteria
- [ ] CI ทุกขั้น (lint/typecheck/test/build/Lighthouse) ผ่านสีเขียวก่อน merge ได้
- [ ] Security rules test ผ่านครบ และ rules ปิดช่องโหว่จริง (ทดสอบเขียนตรงโดยไม่ login แล้วถูกบล็อก)
- [ ] Rate limiting ทำงานจริง (ทดสอบยิง report เกิน 10 ครั้ง/ชม. แล้วถูก reject)
- [ ] PWA ติดตั้งบนมือถือได้, layout desktop แยกจากมือถือชัดเจน
- [ ] Login ด้วย Line ได้จริง, push notification ส่งสำเร็จแม้ปิดแอป
- [ ] Lighthouse ผ่านเกณฑ์ที่กำหนดทั้ง 4 ด้าน
- [ ] หมุดแยกแยะได้โดยไม่ต้องพึ่งสีอย่างเดียว
- [ ] Privacy Policy/ToS เป็นเนื้อหาจริง ไม่ใช่หน้าเปล่า

---

## Roadmap แบ่งเฟส
**Phase 1 (Bootcamp 3 วัน):** core MVP + lint/typecheck/test พื้นฐานผ่าน CI แต่ยังไม่ต้อง Line Login/Security Rules เข้ม/CI เต็มรูป/Lighthouse gate
**Phase 2 (Mentoring ต.ค.-ธ.ค.):** Line Login, Security Rules + test, CI/CD เต็มรูป, moderation, rate limiting, Privacy Policy, observability
**Phase 3 (ก่อน Demo Day):** Lighthouse/accessibility gate ผ่านครบ, feature flags, เก็บ metric จริงสำหรับ pitch, incident runbook พร้อมใช้

อย่าพยายามทำทุกเฟสพร้อมกันในช่วง Bootcamp — กรรมการอยากเห็นว่าทีม "รู้มาตรฐานที่ถูกต้องและมี roadmap ชัด" มากกว่าทำทุกอย่างสมบูรณ์ตั้งแต่วันแรกแล้วพัง
