// Vỏ app Mac (cũng chạy được trên Windows): mở giao diện Trạm Voice Studio trong cửa sổ riêng.
// Giao diện nằm trong thư mục app/ (quy trình build chép index.html, app.js, logic.js... vào đây).
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000, height: 900, minWidth: 380, minHeight: 600,
    title: 'Trạm Voice Studio', backgroundColor: '#eef5f3',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Link ngoài (nếu có) mở bằng trình duyệt, không mở trong app
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
