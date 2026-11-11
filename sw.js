// Service worker ของ WL Substitution — ใช้เพื่อ "แจ้งเตือนของอุปกรณ์" เท่านั้น
// ตั้งใจไม่ดักคำขอไฟล์ (ไม่มี fetch handler / ไม่แคช) เพื่อไม่ให้ผู้ใช้ค้างเวอร์ชันเก่า
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// กดที่แจ้งเตือน → กลับไปที่แอป (หน้าตาม link) หรือเปิดแอปใหม่ถ้าปิดอยู่
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '';
  const url = new URL(link ? `./#${link}` : './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { await c.focus(); c.postMessage({ type: 'wlsub-nav', link }); } else await self.clients.openWindow(url);
  })());
});

// ขั้นถัดไป (Web Push): เซิร์ฟเวอร์ส่ง { title, body, link, tag } มา → แสดงได้แม้ปิดแอปอยู่ (ยังไม่มีฝั่งส่ง)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'WL Substitution', {
    body: d.body || '', tag: d.tag || undefined, icon: 'img/logo-192.png', badge: 'img/logo-64.png', lang: 'th', data: { link: d.link || '' },
  }));
});
