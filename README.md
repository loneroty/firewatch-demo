# FireWatch

FireWatch เป็น MVP สำหรับแพลตฟอร์ม crowdsource รายงานจุดเผา แสดงรายงานบนแผนที่ และตรวจตรรกะยืนยันร่วมแบบ 500m/60 นาที

## สถานะเฟส

เฟสปัจจุบัน: Phase 1 core MVP

- รัน local ได้โดยไม่ต้องมี Firebase project ผ่าน Local demo mode
- รองรับ Firebase public env เมื่อพร้อมต่อ backend จริง
- ยังไม่รวม Line Login, Security Rules เต็มรูป, Push Notification จริง, Admin Dashboard เต็มรูป หรือ Lighthouse gate

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

## Firebase env

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า `NEXT_PUBLIC_FIREBASE_*` เมื่อมี Firebase project จริง ห้าม commit `.env.local`
