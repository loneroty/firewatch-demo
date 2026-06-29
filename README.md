# FireWatch

FireWatch เป็น MVP สำหรับแพลตฟอร์ม crowdsource รายงานจุดเผา แสดงรายงานบนแผนที่ และตรวจตรรกะยืนยันร่วมแบบ 500m/60 นาที

## สถานะเฟส

เฟสปัจจุบัน: Phase 2

- รัน local ได้โดยไม่ต้องมี Firebase project ผ่าน Local demo mode
- รองรับ Firebase public env เมื่อพร้อมต่อ backend จริง
- มี Firestore Security Rules baseline และ Cloud Function สำหรับสร้าง report จริง
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

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

โปรเจกต์นี้ใช้ Next 16 ร่วมกับ `@ducanh2912/next-pwa` จึงบังคับ `next dev --webpack` และ `next build --webpack` ใน scripts เพื่อให้ PWA plugin ทำงานกับ webpack ได้ถูกต้อง

`npm run test` จะรัน unit tests, Firestore Security Rules tests, Storage Rules tests, และ Cloud Function report tests ผ่าน Firebase emulator ถ้าต้องการรันแยกใช้:

```bash
npm run test:rules
npm run test:storage
npm run test:functions
```

Cloud Function `createReport` เป็นทางหลักสำหรับการสร้าง report จริง โดยใช้ `auth.uid` จาก Firebase Auth, ตั้ง `createdAt` ฝั่ง server, และเก็บ hourly rate-limit counter ที่ `rateLimits/{uid}/hours/{yyyyMMddHH}`

## Runtime modes

- Local demo mode: ไม่มี Firebase public env ครบชุด แอปใช้ localStorage, compressed data URL, และ client-side demo rate limit เดิม เหมาะกับการเปิดดู UI บนเครื่องโดยไม่ต้องมี Firebase project
- Firebase backend mode: เมื่อมี Firebase public env ครบชุด แอปจะ sign in แบบ anonymous, ตรวจ App Check, upload รูปไป Firebase Storage ที่ `reportImages/{auth.uid}/{imageId}`, แล้วเรียก callable `createReport` เท่านั้น client ไม่เขียน `reports` ตรงและไม่ส่ง data URL เข้า function
- Backend mode ต้องมี `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`; ถ้ายังไม่มี site key แอปจะแสดง error อ่านรู้เรื่องแทนการ crash ให้ใช้ Local demo mode ระหว่างที่ยังไม่ได้ตั้ง App Check

## Firebase env

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า `NEXT_PUBLIC_FIREBASE_*` เมื่อมี Firebase project จริง ห้าม commit `.env.local`

สำหรับ local Firebase backend emulator ให้ตั้ง `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` และรัน emulators ที่กำหนดใน `firebase.json` ได้แก่ Auth, Firestore, Functions, และ Storage. Local demo mode ไม่ต้องใช้ App Check หรือ Firebase emulator.
