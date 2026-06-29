# Incident Runbook

## Spam หรือรายงานเท็จจำนวนมาก

1. ตรวจจำนวนรายงานต่อผู้ใช้ในช่วง 1 ชั่วโมงล่าสุด
2. ลด rate limit ชั่วคราวผ่าน Remote Config เมื่อระบบนั้นพร้อมใช้งาน
3. ซ่อนรายงานที่มี `flaggedCount >= 3` และส่งเข้าคิว moderation
4. ระงับผู้ใช้ที่พบ pattern ชัดเจนผ่าน admin workflow
5. บันทึกผลกระทบและเงื่อนไขที่ใช้ตัดสินใจใน incident note

## แอป down หรือ error เพิ่มผิดปกติ

1. ตรวจ Sentry และ Firebase Performance Monitoring เมื่อ observability เปิดใช้งาน
2. ตรวจ Vercel deployment ล่าสุดและ environment variables
3. Rollback ไป deployment ก่อนหน้าถ้า error เกิดจาก release ใหม่
4. รัน `npm run lint`, `npm run typecheck`, `npm run test`, และ `npm run build` ก่อน redeploy

## Demo day failure fallback

1. ถ้า Firebase backend error ระหว่าง demo ให้สลับเป็น Local demo mode โดยเอา Firebase public env ออกจาก `.env.local` หรือใช้ environment ที่ไม่มี Firebase config
2. ถ้า error ระบุ App Check ให้ตรวจ `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` และ domain ที่ลงทะเบียนใน Firebase Console ก่อนลองใหม่
3. ถ้า anonymous auth ล้มเหลว ให้ตรวจว่าเปิด Anonymous provider ใน Firebase Auth แล้ว
4. ถ้า Storage upload ล้มเหลว ให้ตรวจ Storage Rules, content type ต้องเป็น `image/*`, ขนาดหลังบีบอัดต้องไม่เกิน 500KB, และ path ต้องเป็น `reportImages/{auth.uid}/{imageId}`
5. ถ้า callable `createReport` reject ให้ตรวจ payload, `gs://` path, App Check token, และ Cloud Functions logs
6. ถ้าเจอ rate limit ระหว่าง demo ให้ใช้ผู้ใช้ใหม่หรือรอ bucket ชั่วโมงถัดไป ห้ามแก้ production limit สดถ้ายังไม่ได้ทดสอบ
7. ถ้าต้อง demo ต่อทันที ให้ใช้ Local demo mode เป็น fallback เพราะ flow นี้ไม่พึ่ง Firebase service

## Security Rules เสี่ยงเปิดกว้าง

1. ห้าม deploy rules ถ้า `npm run test:rules` ไม่ผ่าน
2. ถ้าแก้ Storage Rules ต้องรัน `npm run test:storage` ด้วย
3. ตรวจว่าไม่มี `allow read, write: if true`
4. ทดสอบ unauthenticated write กับ `reports`, `users`, และ `reportImages`
5. Deploy rules แยกขั้นตอนหลัง tests ผ่านเท่านั้น
