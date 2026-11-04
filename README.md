# Trạm Voice Studio — bản web (Windows, Mac, iPhone, Android)

Trang web tĩnh, trình duyệt gọi thẳng API ElevenLabs bằng key **của khách** (ElevenLabs cho phép gọi từ trình duyệt). Không có máy chủ, không tốn tiền chạy.

- Chạy thử trên máy: preview `tram-voice-web` trong `.claude/launch.json` (cổng 8799), hoặc
  `python -m http.server 8799 --directory "du-an/tram-voice-studio/web"` rồi mở http://localhost:8799
- Test logic: `node web/test-logic.mjs`
- File: `index.html` (giao diện), `app.js` (xử lý nút), `logic.js` (biểu cảm + gọi API, chép từ bản Windows), `sw.js` + `manifest.webmanifest` (cài như app trên điện thoại).
- Key khách lưu trong localStorage của trình duyệt trên máy họ; không gửi đi đâu ngoài api.elevenlabs.io.
- Sửa app xong nhớ tăng `VERSION` trong `sw.js` để máy khách nhận bản mới.

## Khác bản Windows
- Không có "Cổng API cho AI khác" (trình duyệt không mở cổng được).
- Không có phần tạo giọng riêng (đã bỏ theo yêu cầu).

## Đưa lên mạng
Phải chạy qua **https** (cài app chỉ chạy trên https). Cách rẻ nhất: GitHub Pages, chép nguyên thư mục `web/` lên repo rồi bật Pages.
Khách mở link → iPhone: Safari → Chia sẻ → **Thêm vào MH chính**; Android: Chrome → **Cài đặt ứng dụng**.
