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

// Test key: xem tài khoản rồi tạo thật chữ "Hi"
const { checkKey } = globalThis.TVS;
const err = (st) => new Response(JSON.stringify({ detail: { status: st } }), { status: 401 });
const ttsCalls = [];
globalThis.fetch = async (url, opts) => {
  const k = opts.headers['xi-api-key']; const sub = url.endsWith('/v1/user/subscription');
  if (!sub) ttsCalls.push(url);
  if (k === 'empty' && sub) return new Response(JSON.stringify({ character_limit: 1000, character_count: 1000 }), { status: 200 });
  if ((k === 'ok' || k === 'notts' || k === 'flagged') && sub) return new Response(JSON.stringify({ character_limit: 1000, character_count: 400 }), { status: 200 });
  if (k === 'noperm' && sub) return err('missing_permissions');
  if (k === 'blocked' && sub) return err('detected_unusual_activity');
  if (k === 'sai') return err('invalid_api_key');
  if (k === 'notts') return err('missing_permissions');
  if (k === 'flagged') return err('detected_unusual_activity');
  return new Response(new Blob(['mp3']), { status: 200 });
};
assert.deepEqual(await checkKey('ok'), { state: 'Tạo giọng OK', left: 600, dead: false });
assert.ok(ttsCalls[0].includes('/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb'));
assert.deepEqual(await checkKey('empty'), { state: 'Hết credit', left: 0, dead: false });
assert.equal((await checkKey('noperm')).state, 'Tạo giọng OK');
assert.deepEqual(await checkKey('notts'), { state: 'Thiếu quyền Text to Speech', left: 600, dead: true });
// Điểm yếu cũ: còn credit nhưng bị chặn khi tạo giọng -> giờ báo hỏng
assert.deepEqual(await checkKey('flagged'), { state: 'Bị ElevenLabs chặn khi tạo giọng', left: 600, dead: true });
assert.equal((await checkKey('blocked')).dead, true);
assert.equal((await checkKey('sai')).dead, true);
console.log('OK: tất cả test logic bản web đều qua');
