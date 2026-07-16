# FireWatch

FireWatch เป็น MVP สำหรับแพลตฟอร์ม crowdsource รายงานจุดเผา แสดงรายงานบนแผนที่ และตรวจตรรกะยืนยันร่วมแบบ 500m/60 นาที

## สถานะเฟส

เฟสปัจจุบัน: Phase 19 Incident Replay & Heatmap Command Center

- รัน local ได้โดยไม่ต้องมี Firebase project ผ่าน Local demo mode
- รองรับ Firebase public env เมื่อต้องการ demo backend ที่แชร์ข้อมูลข้ามเครื่องจริง
- มี Firestore Security Rules baseline, Storage Rules, Cloud Function สำหรับสร้าง report จริง และ Cloud Function สำหรับยืนยัน report
- Firebase backend mode โหลด reports จาก Firestore realtime subscription และยืนยันจุดผ่าน callable `confirmReport`
- มี Live/Replay mode สำหรับย้อนดู report, Alert Zone, risk และ heatmap ตามเวลา โดยคำนวณ client-side จากข้อมูลที่โหลดอยู่แล้ว
- Replay รองรับช่วง 1/3/6/12/24 ชั่วโมงหรือทั้งหมด, timeline แบบ aggregate, ความเร็ว 1x/2x/4x และ deep link `?mode=replay&at=<เวลา>&window=6h`
- Phase 19 ไม่เปลี่ยน backend schema, callable functions, Firestore Rules หรือ Storage Rules
- ยังไม่รวม Line Login, Push Notification จริง, Admin Dashboard เต็มรูป หรือ Lighthouse gate

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

ถ้าใช้ PowerShell แล้วเจอ execution policy block `npm.ps1` ให้ใช้ `npm.cmd` แทน:

```powershell
npm.cmd install
npm.cmd run dev
```

## Competition Demo Quick Start

สำหรับ demo บนเครื่องกรรมการหรือเครื่องพรีเซนต์ ใช้ Local demo mode เป็น path หลักเพราะไม่ต้องมี Firebase config:

```powershell
npm.cmd install
npm.cmd run dev
```

เปิด:

```text
http://localhost:3000
```

ถ้าไม่มี Firebase public env ครบ แอปจะเข้า Local demo mode โดยอัตโนมัติ ใช้ localStorage, compressed data URL, map/list/report form และ client-side demo rate limit ได้ทันที โหมดนี้ไม่แชร์ข้อมูลข้ามเครื่อง

ก่อนขึ้นเวทีให้ verify:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd audit
```

เอกสารสำหรับวันแข่ง:

- `docs/DEMO_SCRIPT.md` สคริปต์พูด 3-5 นาที
- `docs/JUDGING_NOTES.md` ประเด็นสำหรับตอบกรรมการ
- `docs/DEMO_CHECKLIST.md` checklist ก่อนขึ้นเวทีและ fallback

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

โปรเจกต์นี้ใช้ Next 16 ร่วมกับ `@ducanh2912/next-pwa` จึงบังคับ `next dev --webpack` และ `next build --webpack` ใน scripts เพื่อให้ PWA plugin ทำงานกับ webpack ได้ถูกต้อง

`npm run test` จะรัน unit tests, Firestore Security Rules tests, Storage Rules tests, และ Cloud Function tests สำหรับ `createReport`/`confirmReport` ผ่าน Firebase emulator ถ้าต้องการรันแยกใช้:

```bash
npm run test:rules
npm run test:storage
npm run test:functions
```

Cloud Function `createReport` เป็นทางหลักสำหรับการสร้าง report จริง โดยใช้ `auth.uid` จาก Firebase Auth, ตั้ง `createdAt` ฝั่ง server, และเก็บ hourly rate-limit counter ที่ `rateLimits/{uid}/hours/{yyyyMMddHH}` ส่วน `confirmReport` เป็นทางหลักสำหรับการยืนยัน report จริง โดยรับ `targetReportId` กับ `confirmingReportId`, ตรวจว่า confirming report เป็นของ `auth.uid`, อยู่ในระยะ 500m/60 นาที, ไม่ใช่การยืนยันของตัวเองหรือยืนยันซ้ำ, แล้วอัปเดต `confirmedByReportIds`/`verificationStatus` ใน transaction

## Runtime modes

- Local demo mode: ไม่มี Firebase public env ครบชุด แอปใช้ localStorage, compressed data URL, และ client-side demo rate limit เดิม เหมาะกับการเปิดดู UI บนเครื่องโดยไม่ต้องมี Firebase project โหมดนี้ไม่แชร์ข้อมูลข้ามเครื่อง
- Firebase backend mode: เมื่อมี Firebase public env ครบชุด แอปจะ subscribe `reports` ด้วย Firestore realtime, sign in แบบ anonymous, ตรวจ App Check, upload รูปไป Firebase Storage ที่ `reportImages/{auth.uid}/{imageId}`, แล้วเรียก callable `createReport` เท่านั้น client ไม่เขียน `reports` ตรงและไม่ส่ง data URL เข้า function
- การยืนยันใน Firebase backend mode ต้องให้ผู้ยืนยันมี report ของตัวเองใกล้ target ภายใน 500m/60 นาที แล้วเรียก callable `confirmReport`; client ไม่เขียน `confirmedByReportIds` หรือ `verificationStatus` ตรง
- Backend mode ต้องมี `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`; ถ้ายังไม่มี site key แอปจะแสดง error อ่านรู้เรื่องแทนการ crash ให้ใช้ Local demo mode ระหว่างที่ยังไม่ได้ตั้ง App Check
- Live mode รักษา realtime/local flow เดิม ส่วน Replay mode กรองเฉพาะ report ที่เกิดไม่เกิน cursor และคำนวณ Alert Zone/risk aging ด้วยเวลา cursor; hidden/rejected report ไม่เข้า replay heatmap

## Incident Replay

- เปิด Replay จากแผงเหนือแผนที่ แล้วเลือกช่วงเวลา เลื่อน timeline หรือกดเล่นที่ 1x/2x/4x
- Heatmap เป็น Leaflet Canvas overlay แบบ non-interactive จึงยังใช้ marker cluster, Alert Zone, popup และ zoom control พร้อมกันได้
- Timeline รวมเหตุการณ์เป็นไม่เกิน 60 buckets เพื่อไม่คำนวณ Alert Zones ทุก animation frame และรองรับชุดรายงานขนาดใหญ่ได้ลื่นขึ้น
- Deep link รองรับ ISO timestamp หรือ epoch ที่ผ่าน validation; URL จะอัปเดตเมื่อผู้ใช้ปล่อย slider เท่านั้น ไม่อัปเดตระหว่าง playback
- การเล่นย้อนหลังเป็นการแสดงข้อมูลรายงานจากชุมชนตามช่วงเวลา ไม่ใช่การจำลองหรือพยากรณ์เหตุฉุกเฉินอย่างเป็นทางการ และข้อมูลบางช่วงอาจไม่ครบถ้วน

## Firebase env

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า `NEXT_PUBLIC_FIREBASE_*` เมื่อมี Firebase project จริง ห้าม commit `.env.local`

สำหรับ local Firebase backend emulator ให้ตั้ง `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` และรัน emulators ที่กำหนดใน `firebase.json` ได้แก่ Auth, Firestore, Functions, และ Storage. Local demo mode ไม่ต้องใช้ App Check หรือ Firebase emulator.

## Demo readiness

- ก่อน demo ให้รัน `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run build`, และ `npm.cmd audit`
- ใช้ manual smoke checklist ใน `docs/TESTING.md` เพื่อตรวจ Local demo mode, Firebase backend mode, และ failure cases
- ห้าม deploy หรือแก้ production Firebase rules/functions ระหว่างซ้อม demo ถ้ายังไม่ได้รัน test ครบ
