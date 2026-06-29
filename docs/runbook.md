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

## Security Rules เสี่ยงเปิดกว้าง

1. ห้าม deploy rules ถ้า `npm run test:rules` ไม่ผ่าน
2. ตรวจว่าไม่มี `allow read, write: if true`
3. ทดสอบ unauthenticated write กับ `reports` และ `users`
4. Deploy rules แยกขั้นตอนหลัง tests ผ่านเท่านั้น
