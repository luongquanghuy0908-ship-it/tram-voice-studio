// Giao diện Trạm Voice Studio bản web. Logic biểu cảm + gọi API nằm ở logic.js (window.TVS).
(function () {
  const { AUTO, PAUSES, MODELS, TAG_GROUPS, EMOTIONS, prepare, suggestTag, splitSentences, request, synthesize } = window.TVS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Lưu trữ trong trình duyệt (có thể bị chặn ở chế độ ẩn danh nên luôn bọc try) ----------
  const store = {
    get(name, fallback) { try { const v = localStorage.getItem('tvs.' + name); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(name, value) { try { localStorage.setItem('tvs.' + name, JSON.stringify(value)); } catch (e) { toast('Trình duyệt không cho lưu dữ liệu (chế độ ẩn danh?)'); } },
  };

  let keys = store.get('keys', []);   // [{name, key}]
  let voices = [];                    // danh sách giọng từ ElevenLabs
  const undoStack = [];
  let busy = false;

  // ---------- Thông báo ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function setStatus(msg, kind = '') { const s = $('status'); s.textContent = msg; s.className = 'status ' + kind; }

  // ---------- Hộp thoại dùng chung ----------
  const dlg = $('dlg');
  function openDialog(title, html, buttons = []) {
    $('dlgTitle').textContent = title; $('dlgBody').innerHTML = html;
    const foot = $('dlgFoot'); foot.innerHTML = ''; foot.hidden = !buttons.length;
    for (const b of buttons) {
      const el = document.createElement('button'); el.textContent = b.label; if (b.primary) el.className = 'primary';
      el.onclick = b.onClick; foot.appendChild(el);
    }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    $('dlgBody').scrollTop = 0;
  }
  function closeDialog() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  dlg.querySelector('[data-close]').onclick = closeDialog;
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); }); // bấm ra ngoài để đóng

  // ---------- 1. Key ----------
  function renderKeys(select = $('account').selectedIndex) {
    const sel = $('account');
    sel.innerHTML = keys.length ? keys.map((k, i) => `<option value="${i}">${esc(k.name)}</option>`).join('') : '<option value="">Chưa có key nào</option>';
    sel.selectedIndex = Math.min(Math.max(0, select), Math.max(0, keys.length - 1));
    $('renameKey').disabled = $('deleteKey').disabled = !keys.length;
    $('addBox').open = !keys.length;
    if (!keys.length) setStatus('Dán API key để bắt đầu.');
  }
  function current() { return keys[$('account').selectedIndex]; }
  // Thứ tự key khi tạo giọng: bắt đầu từ key đang chọn; tắt tự chuyển thì chỉ dùng key đó
  function orderedKeys() {
    const i = $('account').selectedIndex;
    if (!keys.length) return [];
    return $('autoSwitch').checked ? keys.slice(i).concat(keys.slice(0, i)) : [keys[i]];
  }

  $('saveKey').onclick = () => {
    const key = $('keyValue').value.trim(); const name = $('keyName').value.trim() || 'Tài khoản ' + (keys.length + 1);
    if (!key) return toast('Hãy dán API key.');
    if (keys.some((k) => k.key === key)) return toast('Key này đã được lưu.');
    keys.push({ name, key }); store.set('keys', keys);
    $('keyValue').value = ''; $('keyName').value = '';
    renderKeys(keys.length - 1); toast('Đã lưu key “' + name + '”'); loadVoices();
  };
  // Nhập hàng loạt: mỗi dòng "key" hoặc "Tên | key" (cũng nhận dấu , ; hoặc tab). Key không có khoảng trắng nên lấy phần cuối dòng.
  function parseBulk(text) {
    const out = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const m = line.match(/^(?:(.*?)\s*[|,;\t]\s*)?(\S+)$/);
      if (!m) continue;
      out.push({ name: (m[1] || '').trim(), key: m[2] });
    }
    return out;
  }
  $('saveBulk').onclick = () => {
    const items = parseBulk($('bulkText').value);
    if (!items.length) return toast('Hãy dán ít nhất một key.');
    let added = 0, skipped = 0;
    for (const it of items) {
      if (keys.some((k) => k.key === it.key)) { skipped++; continue; }
      keys.push({ name: it.name || 'Tài khoản ' + (keys.length + 1), key: it.key }); added++;
    }
    if (added) store.set('keys', keys);
    $('bulkText').value = '';
    renderKeys(added ? keys.length - added : undefined);
    toast('Đã lưu ' + added + ' key' + (skipped ? ', bỏ qua ' + skipped + ' key trùng' : ''));
    if (added) loadVoices();
  };
  $('renameKey').onclick = () => {
    const k = current(); if (!k) return;
    const name = prompt('Tên mới cho key:', k.name);
    if (name && name.trim()) { k.name = name.trim(); store.set('keys', keys); renderKeys(); }
  };
  $('deleteKey').onclick = () => {
    const k = current(); if (!k) return;
    if (!confirm('Xóa key “' + k.name + '” khỏi thiết bị này?')) return;
    keys.splice($('account').selectedIndex, 1); store.set('keys', keys); renderKeys(0);
    voices = []; renderVoices();
  };
  $('account').onchange = () => { voices = []; renderVoices(); store.set('account', $('account').selectedIndex); };
  $('autoSwitch').checked = store.get('auto', true);
  $('autoSwitch').onchange = () => store.set('auto', $('autoSwitch').checked);

  $('showCredits').onclick = async () => {
    if (!keys.length) return toast('Hãy lưu ít nhất một API key.');
    openDialog('Credit các tài khoản', '<table><thead><tr><th>Tài khoản</th><th>Đã dùng / Tổng</th><th>Còn lại</th><th>Làm mới</th></tr></thead><tbody id="creditRows">' +
      keys.map((k, i) => `<tr id="cr${i}"><td>${esc(k.name)}</td><td colspan="3">Đang tải…</td></tr>`).join('') +
      '</tbody></table><p class="hint">Xem credit không tốn credit. Lỗi “thiếu quyền” nghĩa là key chưa bật User: Read.</p>');
    const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
    keys.forEach(async (k, i) => {
      let cells;
      try {
        const d = await (await request(k.key, '/v1/user/subscription')).json();
        const used = d.character_count || 0, limit = d.character_limit || 0;
        const reset = d.next_character_count_reset_unix ? new Date(d.next_character_count_reset_unix * 1000).toLocaleDateString('vi-VN') : '';
        cells = `<td>${fmt(used)} / ${fmt(limit)}</td><td><b>${fmt(Math.max(0, limit - used))}</b></td><td>${reset}</td>`;
      } catch (e) { cells = `<td colspan="3" class="danger">${esc(e.message)}</td>`; }
      const row = $('cr' + i); if (row) row.innerHTML = `<td>${esc(k.name)}</td>` + cells;
    });
  };

  // ---------- 2. Giọng ----------
  function voiceText(v) {
    const labels = v.labels && typeof v.labels === 'object' ? Object.entries(v.labels).flat().join(' ') : '';
    return [v.name, v.description, v.category, labels].join(' ').toLowerCase();
  }
  function renderVoices() {
    const q = $('voiceSearch').value.trim().toLowerCase();
    const sel = $('voice'); const keep = sel.value;
    if (!voices.length) { sel.innerHTML = '<option value="">Bấm "Kết nối · Tải giọng" trước</option>'; return; }
    const list = q ? voices.filter((v) => voiceText(v).includes(q)) : voices;
    sel.innerHTML = list.length ? list.map((v) => {
      const extra = v.labels ? [v.labels.gender, v.labels.accent, v.labels.age].filter(Boolean).join(', ') : '';
      return `<option value="${esc(v.voice_id)}">${esc(v.name)}${extra ? ' · ' + esc(extra) : ''}</option>`;
    }).join('') : '<option value="">Không tìm thấy giọng phù hợp</option>';
    if (list.some((v) => v.voice_id === keep)) sel.value = keep;
    else if (store.get('voice') && list.some((v) => v.voice_id === store.get('voice'))) sel.value = store.get('voice');
  }
  async function loadVoices() {
    const k = current(); if (!k) return toast('Hãy lưu một API key trước.');
    setStatus('Đang tải danh sách giọng…'); $('loadVoices').disabled = true;
    try {
      voices = (await (await request(k.key, '/v1/voices')).json()).voices || [];
      renderVoices();
      setStatus('Đã tải ' + voices.length + ' giọng của “' + k.name + '”.', 'ok');
    } catch (e) { setStatus(e.message, 'error'); }
    finally { $('loadVoices').disabled = false; }
  }
  $('loadVoices').onclick = () => loadVoices();
  $('voiceSearch').oninput = renderVoices;
  $('voice').onchange = () => store.set('voice', $('voice').value);
  let sampleAudio;
  $('previewVoice').onclick = () => {
    const v = voices.find((x) => x.voice_id === $('voice').value);
    if (!v || !v.preview_url) return toast('Giọng này không có bản nghe mẫu.');
    if (sampleAudio) sampleAudio.pause();
    sampleAudio = new Audio(v.preview_url); sampleAudio.play().catch(() => toast('Không phát được bản mẫu.'));
  };

  // Model / biểu cảm / ngắt nghỉ / tốc độ
  $('model').innerHTML = MODELS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
  $('emotion').innerHTML = Object.keys(EMOTIONS).concat(AUTO).map((e) => `<option>${esc(e)}</option>`).join('');
  $('pause').innerHTML = PAUSES.map((p) => `<option>${p}</option>`).join('');
  const saved = store.get('settings', {});
  if (saved.model) $('model').value = saved.model;
  if (saved.emotion) $('emotion').value = saved.emotion;
  if (saved.pause) $('pause').value = saved.pause;
  if (saved.speed) $('speed').value = saved.speed;
  function useV3() { $('model').value = 'eleven_v3'; $('speed').value = 1; syncSpeed(); }
  function syncSpeed() {
    const v3 = $('model').value === 'eleven_v3';
    if (v3) $('speed').value = 1;
    $('speed').disabled = v3;
    const s = Number($('speed').value);
    $('speedOut').textContent = s.toFixed(2) + 'x';
    store.set('settings', { model: $('model').value, emotion: $('emotion').value, pause: $('pause').value, speed: s });
  }
  $('model').onchange = () => {
    // Model khác v3 không hiểu thẻ biểu cảm -> trả biểu cảm về Tự nhiên để tránh lỗi
    if ($('model').value !== 'eleven_v3' && $('emotion').value !== 'Tự nhiên') { $('emotion').value = 'Tự nhiên'; toast('Biểu cảm chỉ dùng với Eleven v3.'); }
    syncSpeed();
  };
  $('emotion').onchange = () => { if ($('emotion').value !== 'Tự nhiên') useV3(); syncSpeed(); };
  $('pause').onchange = syncSpeed; $('speed').oninput = syncSpeed;
  syncSpeed();

  // ---------- 3. Văn bản ----------
  const text = $('text');
  text.value = store.get('text', text.value);
  function count() {
    const n = text.value.length; const c = $('counter');
    c.textContent = n.toLocaleString('vi-VN') + ' / 5.000 ký tự'; c.classList.toggle('over', n > 5000);
    store.set('text', text.value);
  }
  text.oninput = count; count();
  function replaceText(value) { undoStack.push(text.value); text.value = value; count(); }
  $('undo').onclick = () => { if (undoStack.length) { text.value = undoStack.pop(); count(); toast('Đã hoàn tác'); } else toast('Không còn gì để hoàn tác'); };

  function insertAtCursor(tag) {
    const s = text.selectionStart ?? text.value.length, e = text.selectionEnd ?? s;
    undoStack.push(text.value);
    const before = s && !/\s/.test(text.value[s - 1]) ? ' ' : ''; // tránh dính chữ: "thế?[whispers]"
    text.value = text.value.slice(0, s) + before + tag + ' ' + text.value.slice(e);
    text.selectionStart = text.selectionEnd = s + before.length + tag.length + 1; count();
  }
  $('openTags').onclick = () => {
    openDialog('Bảng thẻ cảm xúc (Eleven v3)', TAG_GROUPS.map(([group, items]) =>
      `<div class="tag-group"><h4>${esc(group)}</h4><div class="chips">` +
      items.map(([label, tag]) => `<button class="chip" data-tag="${esc(tag)}" title="${esc(tag)}">${esc(label)} <small style="opacity:.6">${esc(tag)}</small></button>`).join('') +
      '</div></div>').join('') +
      '<p class="hint">Bấm một thẻ để chèn vào chỗ con trỏ. Mỗi câu chỉ nên 1–2 thẻ. Multilingual v2 và Flash có thể đọc luôn chữ trong ngoặc, nên app tự chuyển sang Eleven v3.</p>');
    $('dlgBody').querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => {
      insertAtCursor(b.dataset.tag); useV3(); syncSpeed(); closeDialog(); toast('Đã chèn ' + b.dataset.tag);
    });
  };

  $('annotate').onclick = () => {
    const parts = splitSentences(text.value);
    if (!parts.length) return toast('Hãy nhập văn bản trước.');
    const choices = ['Tự nhiên'].concat(Object.entries(EMOTIONS).filter(([, t]) => t).map(([n]) => n));
    const byTag = {}; for (const [n, t] of Object.entries(EMOTIONS)) if (t && !byTag[t]) byTag[t] = n;
    const rows = parts.map((s, i) => {
      const m = s.match(/^\s*(\[[^\]]+\])\s*/); const plain = m ? s.slice(m[0].length) : s;
      const pick = byTag[m ? m[1] : suggestTag(plain)] || 'Tự nhiên';
      return `<div class="sent"><p>${i + 1}. ${esc(plain)}</p><select data-i="${i}">` +
        choices.map((c) => `<option${c === pick ? ' selected' : ''} value="${esc(c)}">${esc(c)}${EMOTIONS[c] ? ' — ' + esc(EMOTIONS[c]) : ''}</option>`).join('') +
        `</select></div>`;
    });
    const plains = parts.map((s) => s.replace(/^\s*\[[^\]]+\]\s*/, ''));
    openDialog('Gắn cảm xúc cho từng câu', '<p class="hint" style="margin-top:0">App đã gợi ý theo nội dung, bạn đổi lại tùy ý rồi bấm Áp dụng.</p>' + rows.join(''), [
      { label: 'Hủy', onClick: closeDialog },
      { label: 'Áp dụng', primary: true, onClick: () => {
        const out = plains.map((p, i) => { const tag = EMOTIONS[$('dlgBody').querySelector(`[data-i="${i}"]`).value]; return (tag ? tag + ' ' : '') + p; });
        replaceText(out.join('\n')); useV3(); $('emotion').value = 'Tự nhiên'; syncSpeed(); closeDialog(); toast('Đã gắn thẻ, chuyển sang Eleven v3');
      } },
    ]);
  };

  $('previewScript').onclick = () => {
    try {
      const s = prepare(text.value, $('model').value, $('emotion').value, $('pause').value);
      openDialog('Xem trước cách đọc (chưa gửi đi)', `<div class="preview">${esc(s)}</div><p class="hint">Gợi ý theo từ khóa, có thể sai ngữ cảnh. Khoảng nghỉ do model quyết định.</p>`);
    } catch (e) { toast(e.message); }
  };

  // ---------- 4. Tạo giọng + kết quả ----------
  let takeCount = 0;
  // Đang chạy trong app Android (Capacitor) hay không
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  async function saveNative(blob, name) {
    try {
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const base64 = await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = fail; r.readAsDataURL(blob); });
      const saved = await Filesystem.writeFile({ path: name, data: base64, directory: 'CACHE' });
      await Share.share({ title: name, files: [saved.uri], dialogTitle: 'Lưu hoặc gửi file MP3' });
    } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast('Không lưu được file: ' + (e && e.message ? e.message : e)); }
  }
  function addTake(blob, info) {
    const box = $('results'); const empty = box.querySelector('.empty'); if (empty) empty.remove();
    const url = URL.createObjectURL(blob); takeCount++;
    const name = 'tram-voice-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.mp3';
    const el = document.createElement('div'); el.className = 'take';
    el.innerHTML = `<div class="meta">#${takeCount} · ${esc(info)}</div><audio controls src="${url}"></audio>
      <div class="row"><a class="btn primary" href="${url}" download="${name}">⬇ Tải MP3</a></div>`;
    // App Android: WebView không tải file bằng thẻ <a download> được -> ghi file rồi mở bảng chia sẻ của máy
    if (NATIVE) {
      const a = el.querySelector('a'); a.removeAttribute('download'); a.removeAttribute('href'); a.textContent = '⬇ Lưu / Chia sẻ MP3';
      a.onclick = () => saveNative(blob, name);
      box.prepend(el); el.querySelector('audio').play().catch(() => {});
      return;
    }
    // Điện thoại (bản trình duyệt): thêm nút Chia sẻ để gửi thẳng qua Zalo/Messenger hoặc lưu vào Tệp
    const file = new File([blob], name, { type: 'audio/mpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const share = document.createElement('button'); share.textContent = '↗ Chia sẻ / Lưu';
      share.onclick = () => navigator.share({ files: [file], title: name }).catch(() => {});
      el.querySelector('.row').appendChild(share);
    }
    box.prepend(el);
    el.querySelector('audio').play().catch(() => {}); // iPhone có thể chặn tự phát, khi đó bấm ▶
  }

  $('generate').onclick = async () => {
    if (busy) return;
    if (!keys.length) { $('addBox').open = true; $('keyValue').focus(); return setStatus('Hãy lưu API key trước.', 'error'); }
    if (!$('voice').value) return setStatus('Hãy bấm “Kết nối · Tải giọng” và chọn giọng.', 'error');
    busy = true; $('generate').disabled = true; $('generate').textContent = 'Đang tạo…'; setStatus('Đang gửi tới ElevenLabs…');
    try {
      const voiceName = $('voice').selectedOptions[0]?.textContent.split(' · ')[0] || '';
      const r = await synthesize(orderedKeys(), {
        text: text.value, voice: $('voice').value, model: $('model').value,
        emotion: $('emotion').value, pause: $('pause').value, speed: Number($('speed').value),
      });
      addTake(r.blob, voiceName + ' · ' + $('model').value + ' · key ' + r.account);
      setStatus('Xong! Dùng key “' + r.account + '”.', 'ok');
      document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { setStatus(e.message, 'error'); }
    finally { busy = false; $('generate').disabled = false; $('generate').textContent = 'Tạo giọng nói'; }
  };

  // ---------- Khởi động ----------
  renderKeys(store.get('account', 0));
  if (keys.length) loadVoices();
  // Cài như app (thêm vào màn hình chính) + mở được khi mạng yếu
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.Capacitor && !navigator.userAgent.includes('Electron')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
