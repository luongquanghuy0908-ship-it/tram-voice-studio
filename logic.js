// Logic biểu cảm + gọi ElevenLabs, chép từ expression.py/gateway.py của bản Windows.
// Viết dạng chạy được cả trong trình duyệt (window.TVS) lẫn Node (để test).
(function (root) {
  const AUTO = 'Tự nhận diện (tiếng Việt)';
  const PAUSES = ['Theo dấu câu gốc', 'Nghỉ rõ cuối câu', 'Nghỉ rõ từng đoạn'];
  const MODELS = [
    ['eleven_multilingual_v2', 'Multilingual v2 · ổn định, chỉnh tốc độ'],
    ['eleven_flash_v2_5', 'Flash v2.5 · nhanh, rẻ'],
    ['eleven_v3', 'Eleven v3 · biểu cảm, thẻ [ ]'],
  ];

  const TAG_GROUPS = [
    ['Cảm xúc / giọng điệu', [['Hào hứng','[excited]'],['Vui','[happy]'],['Buồn','[sad]'],['Giận','[angry]'],['Lo lắng','[nervous]'],['Tò mò','[curious]'],['Mỉa mai','[sarcastic]'],['Tươi tỉnh','[cheerful]'],['Bực','[annoyed]'],['Ngạc nhiên','[surprised]'],['Tinh nghịch','[mischievously]'],['Giọng đều, mặt lạnh','[deadpan]'],['Kịch tính','[dramatic]'],['Hoảng','[panicking]']]],
    ['Phản ứng không lời', [['Cười','[laughs]'],['Cười to hơn','[laughs harder]'],['Cười khúc khích','[chuckles]'],['Cười rúc rích','[giggles]'],['Thở dài','[sighs]'],['Hít mạnh','[gasps]'],['Nuốt nước bọt','[gulps]'],['Hắng giọng','[clears throat]'],['Khóc','[crying]'],['Sụt sịt','[sniffs]'],['Rên rỉ','[groans]'],['Cười thở khò khè','[wheezing]']]],
    ['Cách nói / âm lượng', [['Thì thầm','[whispers]'],['Hét','[shouts]'],['Nói nhỏ','[quietly]'],['Nói to','[loudly]'],['Nói chậm','[slowly]'],['Nói vội','[rushed]'],['Kéo dài giọng','[drawn out]'],['Lắp bắp','[stammers]'],['Ngập ngừng','[hesitates]']]],
    ['Nhịp / ngắt nghỉ', [['Dừng','[pause]'],['Dừng ngắn','[short pause]'],['Dừng lâu','[long pause]']]],
    ['Khác / thử nghiệm', [['Hát','[sings]'],['Thì thầm (biến thể)','[whisper]'],['Hò reo','[woo]'],['Hiệu ứng âm thanh vui','[fart]'],['Giọng cướp biển','[pirate voice]'],['Giọng / chất giọng Pháp','[French accent]']]],
  ];
  const EMOTIONS = { 'Tự nhiên': '' };
  for (const [, items] of TAG_GROUPS) for (const [label, tag] of items) EMOTIONS[label] = tag;

  // Mỗi câu chỉ chọn 1 thẻ điểm cao nhất, tránh lạm dụng thẻ.
  const RULES = {
    '[laughs]':['ha ha','haha','hahaha','cười lớn','phì cười','bật cười'],
    '[crying]':['hu hu','huhu','bật khóc','nức nở','rơi nước mắt'],
    '[whispers]':['thì thầm','khẽ nói','nói thật khẽ','đừng để ai nghe','bí mật này'],
    '[panicking]':['hoảng loạn','cứu tôi','nguy rồi','chạy mau','không kịp nữa'],
    '[angry]':['tức giận','phẫn nộ','đồ khốn','câm đi','im ngay','không thể chấp nhận','quá đáng'],
    '[annoyed]':['bực mình','khó chịu','phiền quá','lại nữa','mệt thật','chán thật'],
    '[sad]':['buồn quá','đau lòng','đau buồn','thất vọng','cô đơn','mất mát','nhớ bạn','chia tay','không còn nữa'],
    '[nervous]':['lo lắng','hồi hộp','bồn chồn','run quá','sợ rằng','không yên tâm'],
    '[surprised]':['không thể tin','thật sao','ôi trời','trời ơi','bất ngờ','ngạc nhiên','cái gì'],
    '[excited]':['tuyệt vời','háo hức','hào hứng','hoan hô','thành công rồi','làm được rồi','quá đã'],
    '[happy]':['vui quá','hạnh phúc','chúc mừng','vui mừng','vui vẻ','yêu quá','cảm ơn bạn'],
    '[cheerful]':['xin chào mọi người','chào buổi sáng','một ngày tuyệt đẹp','cùng bắt đầu'],
    '[curious]':['tại sao','vì sao','liệu rằng','không biết','thế nào','ai là','ở đâu','khi nào'],
    '[sarcastic]':['hay quá nhỉ','giỏi quá nhỉ','tuyệt thật đấy','ồ thế à','chắc tôi tin'],
    '[mischievously]':['đố bạn','trêu một chút','không nói đâu','bật mí nhé','thử đoán xem'],
    '[sighs]':['thở dài','biết làm sao','đành vậy','thôi vậy'],
    '[hesitates]':['ờ thì','à thì','tôi không chắc','có lẽ là','để tôi nghĩ'],
    '[rushed]':['nhanh lên','gấp lắm','không còn thời gian','mau lên'],
  };
  const PRIORITY = Object.keys(RULES);
  const WORD = '[\\p{L}\\p{N}_]';
  // Cụm từ đứng sau "không/chẳng/chưa..." (cách tối đa 2 từ) thì bỏ qua: "không vui vẻ" không phải vui.
  const NEGATION = new RegExp('(?:không|chẳng|chưa|đừng|chẳng hề)(?:\\s+' + WORD + '+){0,2}\\s*$', 'u');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function phrasePresent(lower, phrase) {
    // Không dùng lookbehind để chạy được trên Safari cũ.
    const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + escapeRe(phrase) + '(?!' + WORD + ')', 'gu');
    let m;
    while ((m = re.exec(lower))) {
      const start = m.index + m[1].length;
      if (!NEGATION.test(lower.slice(0, start))) return true;
      re.lastIndex = start + 1;
    }
    return false;
  }

  function suggestTag(sentence) {
    if (/\[[^\]]+\]/.test(sentence)) return '';
    const lower = sentence.toLowerCase();
    const scores = {};
    for (const tag of PRIORITY) scores[tag] = 0;
    for (const [tag, phrases] of Object.entries(RULES)) {
      for (const phrase of phrases) {
        if (phrasePresent(lower, phrase)) {
          const bonus = ['[laughs]','[crying]','[whispers]','[panicking]'].includes(tag) ? 1.5 : 0;
          scores[tag] += 3 + Math.min(1.5, phrase.length / 20) + bonus;
        }
      }
    }
    const ex = (sentence.match(/!/g) || []).length, qs = (sentence.match(/\?/g) || []).length;
    if (qs) scores['[curious]'] += qs === 1 ? 1.7 : 2.4;
    if (ex) scores[(scores['[angry]'] || scores['[annoyed]']) ? '[angry]' : '[excited]'] += 1 + Math.min(ex, 3) * 0.45;
    if (sentence.includes('...') || sentence.includes('…')) scores['[hesitates]'] += 1.4;
    const letters = [...sentence].filter((c) => /\p{L}/u.test(c));
    const upper = letters.filter((c) => c !== c.toLowerCase()).length;
    if (letters.length >= 5 && upper / letters.length > 0.55) scores['[shouts]'] = (scores['[shouts]'] || 0) + 3;
    const order = (t) => (PRIORITY.includes(t) ? PRIORITY.indexOf(t) : 999);
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]));
    return ranked.length && ranked[0][1] >= 1.7 ? ranked[0][0] : '';
  }

  // Tách thành [câu, khoảng trắng, câu, khoảng trắng, ..., câu] như re.split có nhóm bắt của Python.
  function splitPieces(text) {
    const pieces = []; const re = /[.!?…]([ \t]+|\n+)/g; let last = 0, m;
    while ((m = re.exec(text))) {
      const end = m.index + 1;
      pieces.push(text.slice(last, end), m[1]);
      last = end + m[1].length;
    }
    pieces.push(text.slice(last));
    return pieces;
  }

  // Tách câu cho bảng "Gắn thẻ từng câu" (giữ dấu câu ở cuối mỗi câu).
  function splitSentences(text) {
    const out = []; const re = /([.!?…])\s+|\n+/g; let last = 0, m; const t = text.trim();
    while ((m = re.exec(t))) {
      const end = m[1] ? m.index + 1 : m.index;
      out.push(t.slice(last, end)); last = m.index + m[0].length;
    }
    out.push(t.slice(last));
    return out.map((s) => s.trim()).filter(Boolean);
  }

  function prepare(text, model, emotion, pause = PAUSES[0]) {
    if (!PAUSES.includes(pause)) throw new Error('Chế độ ngắt nghỉ không hợp lệ.');
    if (emotion !== AUTO && !(emotion in EMOTIONS)) throw new Error('Biểu cảm không hợp lệ.');
    if ((emotion === AUTO || EMOTIONS[emotion]) && model !== 'eleven_v3') throw new Error('Biểu cảm cần model Eleven v3.');
    const pieces = splitPieces(text.trim());
    if (emotion === AUTO) {
      for (let i = 0; i < pieces.length; i += 2) { const tag = suggestTag(pieces[i]); if (tag) pieces[i] = tag + ' ' + pieces[i]; }
    } else if (EMOTIONS[emotion]) pieces[0] = EMOTIONS[emotion] + ' ' + pieces[0];
    if (pause !== PAUSES[0]) {
      for (let i = 1; i < pieces.length; i += 2) pieces[i] = pause === PAUSES[2] || pieces[i].includes('\n\n') ? '\n\n' : '\n';
    }
    return pieces.join('');
  }

  // ---------- Gọi API ElevenLabs (trình duyệt gọi thẳng, không qua máy chủ nào) ----------
  const API = 'https://api.elevenlabs.io';

  class ApiError extends Error {
    constructor(status, detail) {
      super(apiMessage(status, detail)); this.status = status; this.detail = detail;
    }
  }
  function apiMessage(status, detail) {
    const code = detail && typeof detail === 'object' ? detail.status || '' : '';
    if (code === 'quota_exceeded') return 'Key đã hết quota (hết credit).';
    if (code === 'missing_permissions') return 'Key thiếu quyền. Vào ElevenLabs bật quyền cho key này.';
    if (status === 401) return 'Key sai, đã bị xóa hoặc hết hạn.';
    if (status === 403) return 'Tài khoản thiếu quyền hoặc gói không hỗ trợ.';
    if (status === 429) return 'Gửi quá nhanh, thử lại sau ít phút.';
    if (status === 422) return 'Dữ liệu gửi lên không hợp lệ (giọng/văn bản).';
    return 'ElevenLabs báo lỗi (HTTP ' + status + ').';
  }

  async function request(key, path, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, { ...opts, headers: { 'xi-api-key': key, ...(opts.headers || {}) } });
    } catch (e) {
      throw new Error('Không kết nối được ElevenLabs. Kiểm tra mạng rồi thử lại.');
    }
    if (!res.ok) {
      let detail = null;
      try { detail = (await res.json()).detail; } catch (e) { /* lỗi không phải JSON */ }
      throw new ApiError(res.status, detail);
    }
    return res;
  }

  async function synthesize(keys, { text, voice, model, emotion, pause, speed }) {
    if (!text || !text.trim()) throw new Error('Hãy nhập văn bản.');
    if (!voice) throw new Error('Hãy tải và chọn giọng trước.');
    if (!(speed >= 0.7 && speed <= 1.2)) throw new Error('Tốc độ phải từ 0.7x đến 1.2x.');
    if (model === 'eleven_v3' && Math.abs(speed - 1) > 0.001) throw new Error('Eleven v3 chưa hỗ trợ chỉnh tốc độ. Hãy chọn Multilingual v2 hoặc Flash v2.5.');
    const prepared = prepare(text, model, emotion, pause);
    if (prepared.length > 5000) throw new Error('Tối đa 5.000 ký tự gồm cả thẻ biểu cảm.');
    if (!keys.length) throw new Error('Hãy lưu ít nhất một API key.');
    const payload = { text: prepared, model_id: model };
    if (model !== 'eleven_v3') payload.voice_settings = { speed: Math.round(speed * 100) / 100 };
    // Key nào ElevenLabs báo lỗi (hết quota, key sai, thiếu quyền, bị chặn...) thì chuyển sang key kế tiếp.
    // Lỗi mạng thì dừng luôn (key khác cũng không gọi được). Chỉ có 1 key thì trả nguyên lỗi.
    const errors = [];
    for (const account of keys) {
      try {
        const res = await request(account.key, '/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=mp3_44100_128', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        return { blob: await res.blob(), account: account.name };
      } catch (e) {
        if (!(e instanceof ApiError) || keys.length === 1) throw e;
        errors.push('• ' + account.name + ': ' + e.message);
      }
    }
    throw new Error('Không key nào tạo được giọng:\n' + errors.join('\n'));
  }

  const TEST_VOICE = 'JBFqnCBsd6RMkjVDRZzb'; // giọng George có sẵn ở mọi tài khoản ElevenLabs
  const statusOf = (e) => (e.detail && typeof e.detail === 'object' ? e.detail.status || '' : '');

  // Test 1 key. Bước 1: xem tài khoản (không tốn credit) -> biết key sai / bị chặn / hết credit.
  // Bước 2: tạo thật chữ "Hi" bằng Flash v2.5 (~1 credit) -> chắc chắn key TẠO GIỌNG được.
  // Trả { state, left (credit còn lại hoặc null), dead (key hỏng) }
  async function checkKey(key) {
    let left = null;
    try {
      const d = await (await request(key, '/v1/user/subscription')).json();
      left = Math.max(0, (d.character_limit || 0) - (d.character_count || 0));
      if (left <= 0) return { state: 'Hết credit', left: 0, dead: false };
    } catch (e) {
      if (!(e instanceof ApiError)) return { state: 'Lỗi mạng, thử lại', left: null, dead: false };
      const st = statusOf(e);
      if (st === 'detected_unusual_activity') return { state: 'Bị ElevenLabs chặn (hoạt động bất thường)', left: null, dead: true };
      if (!st.includes('permission')) { // thiếu quyền xem credit thì không sao, vẫn sang bước 2
        if (e.status === 401) return { state: 'Key sai / đã bị xóa', left: null, dead: true };
        if (e.status === 429) return { state: 'Gửi quá nhanh, thử lại sau', left: null, dead: false };
        return { state: 'Lỗi HTTP ' + e.status, left: null, dead: false };
      }
    }
    try {
      const res = await request(key, '/v1/text-to-speech/' + TEST_VOICE + '?output_format=mp3_22050_32', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hi', model_id: 'eleven_flash_v2_5' }),
      });
      const blob = await res.blob();
      if (!blob.size) return { state: 'Không nhận được âm thanh', left, dead: true };
      return { state: 'Tạo giọng OK', left, dead: false };
    } catch (e) {
      if (!(e instanceof ApiError)) return { state: 'Lỗi mạng, thử lại', left, dead: false };
      const st = statusOf(e);
      if (st === 'quota_exceeded') return { state: 'Hết credit', left, dead: false };
      if (st === 'detected_unusual_activity') return { state: 'Bị ElevenLabs chặn khi tạo giọng', left, dead: true };
      if (st.includes('permission')) return { state: 'Thiếu quyền Text to Speech', left, dead: true };
      if (e.status === 401) return { state: 'Key sai / đã bị xóa', left, dead: true };
      if (e.status === 429) return { state: 'Gửi quá nhanh, thử lại sau', left, dead: false };
      return { state: 'Không tạo được giọng (HTTP ' + e.status + ')', left, dead: true };
    }
  }

  root.TVS = { AUTO, PAUSES, MODELS, TAG_GROUPS, EMOTIONS, suggestTag, prepare, splitSentences, request, synthesize, checkKey, ApiError };
})(typeof window !== 'undefined' ? window : globalThis);
