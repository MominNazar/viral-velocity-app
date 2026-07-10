// Ad-hoc smoke test for the photo upload -> enhance -> swipe flow.
const base = 'http://localhost:4000/api';
const j = (r) => r.json();

const login = await fetch(`${base}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'Passw0rd' }),
}).then(j);
const auth = { Authorization: `Bearer ${login.token}` };

const fd = new FormData();
fd.append('photos', new Blob(['fake-image-A'], { type: 'image/jpeg' }), 'a.jpg');
fd.append('photos', new Blob(['fake-image-B'], { type: 'image/jpeg' }), 'b.jpg');
const up = await fetch(`${base}/photos/upload`, { method: 'POST', headers: auth, body: fd }).then(j);
console.log('upload:', { count: up.photos?.length, scores: up.photos?.map((p) => p.score), blocked: up.blocked?.length });

const pid = up.photos[0].photo_id;
const enh = await fetch(`${base}/photos/${pid}/enhance`, {
  method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ count: 5 }),
}).then(j);
console.log('enhance:', { versions: enh.enhancements?.length, scores: enh.enhancements?.map((e) => e.score) });

const e1 = enh.enhancements[0].enhancement_id;
const e2 = enh.enhancements[1].enhancement_id;
const save = await fetch(`${base}/photos/enhancements/${e1}/save`, { method: 'POST', headers: auth }).then(j);
const disc = await fetch(`${base}/photos/enhancements/${e2}/discard`, { method: 'POST', headers: auth }).then(j);
console.log('swipe:', { v1: save.state, v2: disc.state });

const prompt = await fetch(`${base}/photos/${pid}/prompt`, {
  method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: 'brighter colors', enhancementIds: [e1] }),
}).then(j);
console.log('prompt:', { newVersions: prompt.enhancements?.length });

const lib = await fetch(`${base}/photos?sort=score&order=desc`, { headers: auth }).then(j);
console.log('library:', { items: lib.photos?.length, topScore: lib.photos?.[0]?.score });

// moderation block test
const fd2 = new FormData();
fd2.append('photos', new Blob(['x'], { type: 'image/jpeg' }), 'nsfw-photo.jpg');
const blk = await fetch(`${base}/photos/upload`, { method: 'POST', headers: auth, body: fd2 }).then(j);
console.log('moderation:', { stored: blk.photos?.length, blocked: blk.blocked?.length });
