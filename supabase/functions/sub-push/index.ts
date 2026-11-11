// =====================================================================
//  Supabase Edge Function "sub-push" — ส่ง Web Push ให้อุปกรณ์ของผู้ใช้เมื่อมีรายการใหม่ในกระดิ่ง (sub_notifications)
//  ถูกเรียกจากทริกเกอร์ในฐานข้อมูล (pg_net) พร้อมหัว x-sub-secret · ไม่ใช้ไลบรารีภายนอก (Web Crypto ล้วน: RFC 8291 + VAPID RFC 8292)
//  Secrets ที่ต้องตั้ง: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUB_PUSH_SECRET (ไม่บังคับ: VAPID_SUBJECT = mailto:… หรือ https://…)
//  ตั้งค่าฟังก์ชัน: ปิด "Verify JWT" (ฟังก์ชันตรวจ x-sub-secret เอง)
//  เขียนเป็น JavaScript ล้วน (ไม่มี type) เพื่อให้วางในตัวแก้ไขของ Dashboard ได้ทันทีและทดสอบด้วย Node ได้
// =====================================================================
const te = new TextEncoder();
const b64uToBytes = (s) => { const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const bytesToB64u = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
  await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));

/** เข้ารหัสข้อความตาม RFC 8291 (aes128gcm) — คืน body ที่ส่งให้ push service */
export async function encryptPayload(text, p256dh, auth) {
  const uaPub = b64uToBytes(p256dh); const authSecret = b64uToBytes(auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(te.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, cipher);   // salt | rs=4096 | idlen | keyid | ciphertext
}

/** หัว Authorization แบบ VAPID (JWT ES256 อายุ 12 ชั่วโมง) สำหรับ endpoint นั้น */
export async function vapidAuth(endpoint, publicKey, privateKey, subject) {
  const pub = b64uToBytes(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = bytesToB64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${bytesToB64u(sig)}, k=${publicKey}`;
}

/** ส่ง 1 ข้อความไปยัง 1 อุปกรณ์ — คืนรหัสสถานะ HTTP ของ push service (201 = รับแล้ว · 404/410 = อุปกรณ์เลิกรับแล้ว) */
export async function sendPush(sub, payload, vapid) {
  const body = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, { method: 'POST', body,
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'high',
      Authorization: await vapidAuth(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject) } });
  return r.status;
}

async function handler(req) {
  const env = (k) => Deno.env.get(k) || '';
  if (!env('SUB_PUSH_SECRET') || req.headers.get('x-sub-secret') !== env('SUB_PUSH_SECRET')) return new Response('forbidden', { status: 403 });
  if (!env('VAPID_PUBLIC_KEY') || !env('VAPID_PRIVATE_KEY')) return new Response('missing VAPID secrets', { status: 500 });
  let n; try { n = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  if (!/^[0-9a-f-]{36}$/i.test(n.user_id || '')) return new Response('bad user_id', { status: 400 });
  const rest = `${env('SUPABASE_URL')}/rest/v1/sub_push_subs`;
  const h = { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` };
  const subs = await (await fetch(`${rest}?user_id=eq.${n.user_id}&select=endpoint,p256dh,auth`, { headers: h })).json();
  if (!Array.isArray(subs)) return new Response(JSON.stringify(subs), { status: 500 });
  const vapid = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') || env('SUPABASE_URL') };
  const payload = { title: String(n.title || '').slice(0, 120), body: String(n.body || '').slice(0, 400), link: String(n.link || ''), tag: `wlsub-${n.id}` };
  const out = await Promise.all(subs.map(async (s) => {
    try {
      const st = await sendPush(s, payload, vapid);
      if (st === 404 || st === 410) await fetch(`${rest}?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: h });   // อุปกรณ์ยกเลิกแล้ว → ลบทิ้ง
      return st;
    } catch (e) { return String(e && e.message || e); }
  }));
  return new Response(JSON.stringify({ sent: out }), { headers: { 'content-type': 'application/json' } });
}
if (typeof Deno !== 'undefined') Deno.serve(handler);
