# AGENTS.md

อ่านทั้งไฟล์นี้ก่อนแก้/เพิ่มโค้ดทุกครั้ง ไม่มีข้อยกเว้น

## ภาพรวมโปรเจกต์
FireWatch — แพลตฟอร์ม crowdsource รายงานจุดเผา แสดงแผนที่ความเสี่ยงเรียลไทม์ เตือนคนใกล้เคียง ส่งสรุปให้หน่วยงานท้องถิ่น เป็น PWA (มือถือ+เว็บ+desktop จากโค้ดชุดเดียว) ที่ต้องใช้งานได้จริงกับคนทั่วไป ไม่ใช่ของเล่น

สเปกฟีเจอร์เต็มอยู่ใน `codex-prompt-crowdsource-app-godmode.md` ที่ root — เป็นแหล่งความจริงเรื่อง feature

---

## 🔒 กฎเหล็ก (ห้ามฝ่าฝืนไม่ว่ากรณีใด)

1. **ห้าม merge โค้ดที่ lint หรือ typecheck ไม่ผ่าน** — ไม่มีข้อยกเว้นแม้จะ "เดี๋ยวค่อยแก้"
2. **ห้ามใช้ `any` ใน TypeScript** เปิด `strict: true`, `noImplicitAny: true` ใน `tsconfig.json` ตั้งแต่ commit แรก
3. **ห้าม hardcode secret/API key ในโค้ดเด็ดขาด** ทุกค่าต้องมาจาก environment variable และ `.env.local` ต้องอยู่ใน `.gitignore` เสมอ
4. **ห้ามปล่อย Firestore Security Rules แบบเปิดกว้าง (`allow read, write: if true`) ขึ้น production เด็ดขาด** ต้องมี automated test ของ rules ผ่านก่อนเท่านั้น (ดูหัวข้อ Security Testing)
5. **ห้ามใช้ `console.log` ดิบๆ ใน production code** ใช้ logger utility ที่กำหนดไว้ (ดูหัวข้อ Observability) เพื่อให้ filter/ปิด log ได้ตอน deploy จริง
6. **ห้ามเดาเอาเองเวลาสเปกไม่ชัดหรือเจอทางแยกทางเทคนิคที่กระทบ architecture** — ต้องหยุดและถามก่อนเสมอ ห้ามเลือกทางใดทางหนึ่งเงียบๆแล้วทำต่อ
7. **ห้ามข้าม test ของ verification/reputation logic** เพราะเป็นหัวใจของระบบป้องกันการเอาเปรียบ ทุกการแก้ logic นี้ต้องมี test ครอบคลุม edge case ใหม่ด้วย
8. **ห้าม commit ตรงเข้า `main`** ทุกงานต้องอยู่ใน branch แยกตามด้านล่าง แม้จะทำงานคนเดียวก็ตาม

---

## ตอนนี้อยู่เฟสไหน
ถามผู้ใช้ก่อนเริ่มงานชิ้นใหญ่ถ้าไม่ได้ระบุมา — แต่ **กฎเหล็กข้างบนใช้ทุกเฟส ไม่มีข้อยกเว้นแม้ใน Phase 1**

- **Phase 1 (Bootcamp 3 วัน):** core MVP, anonymous auth พอ, ยังไม่ต้องทำ Line Login/Security Rules เข้ม/Privacy Policy แต่ lint+typecheck+test พื้นฐานต้องผ่านทุก commit เหมือนเดิม
- **Phase 2 (Mentoring & Prototyping):** Line Login เต็มรูป, Security Rules + automated rules testing, PWA, responsive desktop, moderation, Privacy Policy/ToS, CI/CD pipeline เต็มรูป
- **Phase 3 (ก่อน Demo Day):** performance/accessibility budget ต้องผ่านเกณฑ์, observability เต็มรูป, เก็บ metric จริงสำหรับ pitch

---

## Tech Stack (ห้ามเปลี่ยนโดยไม่ถามก่อน)
- Next.js (App Router) + TypeScript (`strict: true`) + Tailwind CSS
- PWA: `@ducanh2912/next-pwa`
- Map: Leaflet.js + OpenStreetMap + `leaflet.markercluster`
- Backend: Firebase (Firestore, Storage, Cloud Functions, Cloud Messaging, App Check, Remote Config)
- Auth: Line Login (Phase 2+), Anonymous Auth (Phase 1 เท่านั้น)
- Hosting: Vercel
- Observability: Sentry + Firebase Performance Monitoring + Firebase Analytics
- Testing: Jest (unit) + `@firebase/rules-unit-testing` (security rules) + Playwright (E2E, Phase 2+) + Lighthouse CI (performance/a11y/PWA gate)

---

## Git Workflow (บังคับ)
- Branch naming: `feature/ชื่อฟีเจอร์`, `fix/ชื่อบัค`, `chore/...`
- Commit message ตาม Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- ห้าม commit ตรงเข้า `main` — เปิด PR เสมอ แม้ทำงานคนเดียว (simulate review ด้วยการอ่านซ้ำก่อน merge)
- ทุก merge เข้า `main` ต้อง trigger production deploy อัตโนมัติผ่าน CI/CD (ดูด้านล่าง)
- ทุก PR ต้องอัปเดต `CHANGELOG.md` ตามรูปแบบ Keep a Changelog

---

## CI/CD Pipeline (GitHub Actions) — ต้องตั้งให้ครบ
สร้าง `.github/workflows/ci.yml` ที่รันทุกครั้งที่เปิด PR:
```yaml
steps:
  - install dependencies
  - npm run lint            # ต้องผ่าน ไม่งั้น block merge
  - npm run typecheck       # tsc --noEmit ต้องผ่าน
  - npm run test            # unit test รวม security rules test
  - npm run build           # ต้อง build สำเร็จ
  - lighthouse-ci           # Performance >= 90, Accessibility >= 90, Best Practices >= 90, PWA installable = pass
  - deploy preview ขึ้น Vercel preview URL ให้รีวิวก่อน merge
```
เมื่อ merge เข้า `main`: deploy production อัตโนมัติ + รัน security rules deploy แยกขั้นตอน (อย่า deploy rules พร้อม code โดยไม่ test ก่อน)

---

## Security Testing (บังคับตั้งแต่เริ่มเขียน Security Rules)
ต้องมีไฟล์ test แยก เช่น `firestore.rules.test.ts` ใช้ `@firebase/rules-unit-testing` ทดสอบอย่างน้อย:
- คนที่ไม่ login ต้อง**เขียน** `reports`/`users` ไม่ได้ (แต่อ่านได้ตามสเปก)
- user A ต้องแก้ไข document `users/{B}` ของ user B ไม่ได้
- เฉพาะ uid ใน collection `admins` เท่านั้นที่อ่าน/แก้ admin-only field ได้
- รัน test เหล่านี้ใน CI ทุกครั้งก่อน deploy rules จริง ห้าม deploy rules ที่ test ไม่ผ่าน

---

## Observability (บังคับ Phase 2+)
- สร้าง `lib/logger.ts` เป็น wrapper เดียว ห้ามเรียก `console.log` ตรงๆในโค้ดอื่น
- ทุก error ที่จับใน try/catch ต้องส่งเข้า Sentry พร้อม context (userId, action ที่ทำอยู่)
- ติด Firebase Performance Monitoring เพื่อดู loading time ของแผนที่/หน้ารายงานจริงจากผู้ใช้

## Rate Limiting & Abuse Prevention (เพิ่มจาก reputation score เดิม)
- Cloud Function ที่รับ report ใหม่ต้องเช็ค: user เดียวกันส่ง report ได้ไม่เกิน 10 ครั้ง/ชั่วโมง ถ้าเกินให้ reject พร้อม error message ที่ชัดเจน ป้องกัน spam ที่ reputation score อย่างเดียวเอาไม่อยู่
- ใช้ Firebase App Check บังคับทุก request มาจากแอปจริง ไม่ใช่ script ยิงตรง

## Feature Flags (Phase 2+)
ใช้ Firebase Remote Config คุมการเปิด/ปิดฟีเจอร์ใหม่ (เช่น moderation, push notification) โดยไม่ต้อง deploy ใหม่ทุกครั้ง เพื่อทดสอบกับผู้ใช้กลุ่มเล็กก่อนเปิดทุกคน

## Performance & Accessibility Budget (Phase 3 ต้องผ่านก่อนถือว่า "เสร็จ")
- Lighthouse: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, PWA installable check ผ่าน
- หมุดบนแผนที่ต้องแยกแยะได้ไม่ใช่ด้วยสีอย่างเดียว (เพิ่มไอคอน/รูปทรงต่างกันสำหรับสถานะต่างกัน) เพื่อรองรับผู้ใช้ที่ตาบอดสี
- รูปทุกรูปต้องมี alt text, ปุ่มทุกปุ่มต้องกด tab navigate ได้

---

## โครงสร้างไฟล์
```
/app /components /lib /functions
/firestore.rules + /firestore.rules.test.ts
/.github/workflows/ci.yml
/docs/runbook.md         → ขั้นตอนรับมือเหตุการณ์ผิดปกติ (ดูด้านล่าง)
CHANGELOG.md
```

## Incident Runbook (`/docs/runbook.md` ต้องมีตั้งแต่ Phase 2)
เขียนสั้นๆไว้ล่วงหน้าว่าทำอะไรถ้าเกิดเหตุ เช่น:
- มีคน spam รายงานเท็จจำนวนมาก → ลด rate limit ชั่วคราวผ่าน Remote Config, ตรวจ log หา pattern, suspend user ที่เกี่ยวข้อง
- แอป down/error เยอะผิดปกติ → เช็ค Sentry ก่อน, rollback เป็น deploy ก่อนหน้าผ่าน Vercel ได้ทันที

---

## ขอบเขตที่ห้ามเกิน
- ห้ามเพิ่มฟีเจอร์นอกสเปกหลักโดยไม่ถามก่อน
- ห้ามทำ ML/AI พยากรณ์เพิ่มเอง
- ห้ามทำแอป native แยก (ใช้ PWA ตามที่ตกลง) เว้นแต่จะถามและเปลี่ยนแผนกันก่อน

## Definition of Done (เช็คทุกข้อ ห้ามข้าม)
- [ ] lint + typecheck + unit test + build ผ่านใน CI
- [ ] ถ้าแก้ Security Rules: rules test ผ่านครบ
- [ ] ถ้าเป็น Phase 3: Lighthouse gate ผ่านครบ
- [ ] CHANGELOG.md อัปเดตแล้ว
- [ ] ตรงตาม Acceptance Criteria ของเฟสนั้นใน `codex-prompt-crowdsource-app-godmode.md`

ถ้าข้อใดไม่ผ่านและไม่รู้จะแก้ยังไง — **หยุดและรายงานปัญหาตรงๆ ห้ามปิด test หรือลด threshold เพื่อให้ผ่านง่ายๆ**
