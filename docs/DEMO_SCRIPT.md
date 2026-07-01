# FireWatch Demo Script

## Goal

ใช้เป็นสคริปต์พูด demo 3-5 นาทีสำหรับการแข่งขันหรือพรีเซนต์ FireWatch โดยเน้นสิ่งที่ระบบทำได้จริงในตอนนี้

## 0:00-0:45 Pain Point

ทุกฤดูควันและไฟป่า คนในพื้นที่มักเห็นเหตุการณ์ก่อนระบบทางการ แต่ช่องทางรายงานมักกระจัดกระจาย ช้า หรือไม่มีข้อมูลพิกัดกับหลักฐานรูปภาพที่ใช้งานต่อได้ทันที

FireWatch แก้ปัญหานี้ด้วย crowdsource report: ให้ประชาชนรายงานจุดเผา ควัน หรือไฟป่า พร้อมพิกัด รูปถ่าย และระดับความรุนแรง แล้วรวมข้อมูลบนแผนที่เพื่อให้คนใกล้เคียงและหน่วยงานเห็นภาพสถานการณ์เร็วขึ้น

## 0:45-1:45 Local Demo Mode

ตอนนี้ผมเปิดแอปใน Local demo mode ซึ่งไม่ต้องใช้ Firebase config และเหมาะสำหรับ demo ที่ต้องเสถียรบนเครื่องเดียว โหมดนี้ใช้ localStorage จึงไม่แชร์ข้อมูลข้ามเครื่อง

หน้าเว็บเวอร์ชันล่าสุดถูกจัดเป็นหลายส่วนเหมือนผลิตภัณฑ์จริง: หน้าแรกพร้อม CTA, สรุปสถานการณ์, แผนที่สด, ฟอร์มแจ้งเหตุ, รายงานล่าสุด, วิธีการทำงาน และส่วนความปลอดภัยสำหรับกรรมการสายเทคนิค

จุดที่แสดง:

- แผนที่รายงานจุดเสี่ยงพร้อม marker และรายการรายงานล่าสุด
- ฟอร์มรายงานที่เลือกประเภท ความรุนแรง พื้นที่ พิกัด และรูปถ่ายได้
- ปุ่ม GPS สำหรับดึงตำแหน่งจาก browser
- รูปถูกบีบอัดก่อนบันทึกเพื่อให้เหมาะกับมือถือและลดขนาด payload
- รายงานใหม่ถูกเก็บใน localStorage และแสดงบน map/list ทันที

ให้ demo โดยส่งรายงานหนึ่งรายการ แล้วชี้ให้เห็นว่ารายงานใหม่ขึ้นใน list และ map โดยไม่ต้องมี backend

## 1:45-2:45 Trust And Verification

FireWatch ไม่ได้ดูแค่การรับรายงาน แต่คิดเรื่องความน่าเชื่อถือตั้งแต่ต้น

ใน Local demo มี verification logic ที่ตรวจว่ามีรายงานจากคนอื่นในรัศมี 500 เมตร และภายใน 60 นาทีหรือไม่ ถ้ามี รายงานจะถูกยืนยันร่วมกัน รายงานจาก user คนเดียวกันจะไม่ยืนยันตัวเอง

สำหรับ backend demo จริง Phase 5 เพิ่ม flow ยืนยันแบบใช้หลักฐาน: คนที่กด "ยืนยันจุดนี้" ต้องมี report ของตัวเองที่อยู่ใกล้ target ภายใน 500 เมตรและ 60 นาที แล้วระบบส่ง `targetReportId` กับ `confirmingReportId` ไปที่ Cloud Function `confirmReport` แทนการโหวตลอย ๆ

ระบบยังมี reputation score และ rate limit 10 reports/hour เพื่อช่วยลด spam ใน demo ส่วน production path ย้าย rate limit สำคัญไปไว้ฝั่ง server แล้ว

## 2:45-3:45 Firebase Backend Mode

ถ้ามี Firebase public env ครบ แอปจะเข้า Firebase backend mode

flow จริงคือ:

1. client ตรวจ Firebase config
2. subscribe `reports` จาก Firestore realtime เพื่อให้เครื่องอื่นเห็นจุดเดียวกัน
3. sign in แบบ anonymous
4. ตรวจ App Check
5. upload รูปไป Firebase Storage ที่ `reportImages/{auth.uid}/{imageId}`
6. ส่ง callable `createReport`
7. Cloud Function ใช้ `auth.uid` เป็น source of truth
8. Function validate payload, ตั้ง `createdAt` ฝั่ง server, ตรวจ `gs://` path, และเขียน report ผ่าน Admin SDK
9. เมื่ออีกคนมี report ใกล้เคียง ระบบเรียก callable `confirmReport` เพื่อยืนยัน target report

จุดสำคัญคือ client ไม่เขียน `reports` ตรง และไม่สามารถตั้ง field อย่าง verification, moderation, `confirmedByReportIds`, reputation หรือ rate-limit counter เองได้

## 3:45-4:45 Security And Abuse Prevention

Firestore Rules block direct client create ไปที่ `reports` ดังนั้น production report creation ต้องผ่าน Cloud Function เท่านั้น

Storage Rules อนุญาตเฉพาะ authenticated user upload รูปไป path ของตัวเอง `reportImages/{auth.uid}/{imageId}` จำกัด `image/*` และขนาด 500KB พร้อม block update/delete

Cloud Function `createReport` enforce App Check, validate lat/lng/category/severity/text/photo metadata, validate `gs://` path ว่าเป็นของ user เดียวกัน และใช้ Firestore transaction ทำ hourly rate limit 10 reports/hour ที่ `rateLimits/{uid}/hours/{yyyyMMddHH}`

Cloud Function `confirmReport` enforce App Check เช่นกัน ใช้ `auth.uid` เป็น source of truth, reject การยืนยันรายงานของตัวเองหรือยืนยันซ้ำ, ตรวจว่า confirming report เป็นของผู้ใช้ปัจจุบันและอยู่ในเงื่อนไข 500m/60 นาที แล้วจึงอัปเดต `confirmedByReportIds` และ `verificationStatus` ใน transaction

## 4:45-5:00 Close

สรุปคือ FireWatch เป็น MVP ที่รันได้จริงทั้ง local demo และ Firebase shared backend mode จุดแข็งคือรายงานเร็วจากประชาชน แสดงบนแผนที่ทันที ข้ามเครื่องได้ผ่าน Firestore realtime มีหลักฐานรูปภาพ มีกลไกยืนยันด้วย report ใกล้เคียง และมี security/rate limit ฝั่ง backend เพื่อให้ต่อยอดเป็นระบบภาคสนามจริงได้

