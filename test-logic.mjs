// Chạy: node web/test-logic.mjs — so kết quả bản web với các ca test của bản Windows (test_app.py)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('./logic.js');
const { prepare, suggestTag, AUTO, PAUSES, EMOTIONS, splitSentences, synthesize } = globalThis.TVS;

assert.equal(prepare('Tuyệt vời! Tôi buồn quá. Giá 3.14 đồng.', 'eleven_v3', AUTO, PAUSES[1]), '[excited] Tuyệt vời!\n[sad] Tôi buồn quá.\nGiá 3.14 đồng.');
assert.equal(prepare('Tôi không vui vẻ.', 'eleven_v3', AUTO), 'Tôi không vui vẻ.');
assert.equal(prepare('[sad] Tuyệt vời!', 'eleven_v3', AUTO), '[sad] Tuyệt vời!');
assert.equal(suggestTag('HAHA, chuyện này vui quá!'), '[laughs]');
assert.equal(suggestTag('Tại sao bạn lại làm như vậy?'), '[curious]');
assert.equal(suggestTag('CHẠY MAU, NGUY HIỂM!'), '[panicking]');
assert.equal(prepare('Xin chào. Tạm biệt.', 'eleven_v3', 'Buồn'), '[sad] Xin chào. Tạm biệt.');
assert.equal(prepare('A. B.\n\nC.', 'eleven_multilingual_v2', 'Tự nhiên', PAUSES[2]), 'A.\n\nB.\n\nC.');
assert.throws(() => prepare('Hi', 'eleven_flash_v2_5', 'Buồn'), /Eleven v3/);
for (const tag of ['[excited]','[laughs harder]','[clears throat]','[long pause]','[pirate voice]','[French accent]']) assert.ok(Object.values(EMOTIONS).includes(tag));
assert.deepEqual(splitSentences('Một câu. Hai câu!\nBa câu'), ['Một câu.', 'Hai câu!', 'Ba câu']);

// Tự chuyển key: key 1 hết quota -> dùng key 2; lỗi khác thì dừng ngay
const calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push(opts.headers['xi-api-key']);
  if (opts.headers['xi-api-key'] === 'het') return new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), { status: 401 });
  if (opts.headers['xi-api-key'] === 'sai') return new Response(JSON.stringify({ detail: { status: 'invalid_api_key' } }), { status: 401 });
  return new Response(new Blob(['mp3']), { status: 200 });
};
const job = { text: 'Xin chào', voice: 'abc', model: 'eleven_multilingual_v2', emotion: 'Tự nhiên', pause: PAUSES[0], speed: 1 };
const r = await synthesize([{ name: 'A', key: 'het' }, { name: 'B', key: 'tot' }], job);
assert.equal(r.account, 'B'); assert.deepEqual(calls, ['het', 'tot']);
// Key sai (lỗi bất kỳ) cũng chuyển sang key kế tiếp
assert.equal((await synthesize([{ name: 'A', key: 'sai' }, { name: 'B', key: 'tot' }], job)).account, 'B');
// Tất cả key đều lỗi -> báo lý do từng key
await assert.rejects(synthesize([{ name: 'A', key: 'het' }, { name: 'B', key: 'sai' }], job), /A: Key đã hết quota[\s\S]*B: Key sai/);
// Chỉ 1 key -> trả nguyên lỗi
await assert.rejects(synthesize([{ name: 'A', key: 'het' }], job), /hết quota/);
await assert.rejects(synthesize([{ name: 'A', key: 'tot' }], { ...job, model: 'eleven_v3', speed: 1.1 }), /tốc độ/);

// Test key (không tốn credit)
const { checkKey } = globalThis.TVS;
globalThis.fetch = async (url, opts) => {
  const k = opts.headers['xi-api-key'];
  if (k === 'ok') return new Response(JSON.stringify({ character_limit: 1000, character_count: 400 }), { status: 200 });
  if (k === 'empty') return new Response(JSON.stringify({ character_limit: 1000, character_count: 1000 }), { status: 200 });
  if (k === 'noperm' && url.endsWith('/v1/voices')) return new Response('{}', { status: 200 });
  const st = { noperm: 'missing_permissions', blocked: 'detected_unusual_activity' }[k] || 'invalid_api_key';
  return new Response(JSON.stringify({ detail: { status: st } }), { status: 401 });
};
assert.deepEqual(await checkKey('ok'), { state: 'Dùng được', left: 600, dead: false });
assert.equal((await checkKey('empty')).state, 'Hết credit');
assert.equal((await checkKey('noperm')).state, 'Dùng được (không xem được credit)');
assert.equal((await checkKey('blocked')).dead, true);
assert.equal((await checkKey('sai')).dead, true);
console.log('OK: tất cả test logic bản web đều qua');
