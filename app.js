// ============================================================
//  POS DZ - app.js  |  قاعدة البيانات والمنطق المشترك
// ============================================================

// ── IndexedDB Setup ──────────────────────────────────────────
const DB_NAME = 'POSDZ_DB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Users
      if (!db.objectStoreNames.contains('users')) {
        const us = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        us.createIndex('username', 'username', { unique: true });
      }
      // Products
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('name', 'name', { unique: true });
        ps.createIndex('barcode', 'barcode', { unique: false });
      }
      // Families
      if (!db.objectStoreNames.contains('families')) {
        const fs = db.createObjectStore('families', { keyPath: 'id', autoIncrement: true });
        fs.createIndex('name', 'name', { unique: true });
      }
      // Customers
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      }
      // Suppliers
      if (!db.objectStoreNames.contains('suppliers')) {
        db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
      }
      // Sales
      if (!db.objectStoreNames.contains('sales')) {
        const ss = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('date', 'date', { unique: false });
        ss.createIndex('customerId', 'customerId', { unique: false });
      }
      // Sale Items
      if (!db.objectStoreNames.contains('saleItems')) {
        const si = db.createObjectStore('saleItems', { keyPath: 'id', autoIncrement: true });
        si.createIndex('saleId', 'saleId', { unique: false });
      }
      // Debts
      if (!db.objectStoreNames.contains('debts')) {
        const di = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
        di.createIndex('customerId', 'customerId', { unique: false });
      }
      // Settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // Operations Log
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
      // Daily Counter
      if (!db.objectStoreNames.contains('counter')) {
        db.createObjectStore('counter', { keyPath: 'id' });
      }
    };

    req.onsuccess = async (e) => {
      db = e.target.result;
      await seedDefaults();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic DB Helpers ───────────────────────────────────────
function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbAdd(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function dbGetByIndex(store, indexName, value) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).getAll(value);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

// ── Settings ─────────────────────────────────────────────────
async function getSetting(key) {
  const rec = await dbGet('settings', key);
  return rec ? rec.value : null;
}
async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}

// ── Default Seed Data ─────────────────────────────────────────
async function seedDefaults() {
  // Default admin user
  try {
    await dbAdd('users', {
      username: 'ADMIN',
      password: hashPassword('1234'),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
  } catch(e) {}

  // Default settings
  const defaults = {
    storeName: 'اسم المتجر', storePhone: '', storeAddress: '',
    storeWelcome: 'شكراً لزيارتكم', storeLogo: '',
    currency: 'DA', language: 'ar', dateFormat: 'DD/MM/YYYY',
    themeColor: 'blue_purple', fontSize: '15',
    soundAdd: '1', soundSell: '1', soundButtons: '1',
    barcodeReader: '1', barcodeAuto: '1',
    touchKeyboard: '0',
    paperSize: '80mm',
    printLogo: '1', printName: '1', printPhone: '1',
    printWelcome: '1', printAddress: '1', printBarcode: '1',
    autoBackup: '1',
    invoiceNumber: '1',
    lowStockAlert: '5', expiryAlertDays: '30',
    lastResetDate: '', dailyCounter: '1',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await dbGet('settings', key);
    if (!existing) await dbPut('settings', { key, value });
  }

  // Daily counter
  const counter = await dbGet('counter', 1);
  if (!counter) await dbPut('counter', { id: 1, number: 1, lastReset: todayStr() });
}

// ── Password ─────────────────────────────────────────────────
function hashPassword(str) {
  // Simple hash for browser (use SHA-256 via SubtleCrypto in production)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

// ── Session ───────────────────────────────────────────────────
function saveSession(user) {
  sessionStorage.setItem('posdz_user', JSON.stringify(user));
}
function getSession() {
  const u = sessionStorage.getItem('posdz_user');
  return u ? JSON.parse(u) : null;
}
function clearSession() {
  sessionStorage.removeItem('posdz_user');
}
function requireAuth(redirectTo = 'index.html') {
  const user = getSession();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}
function requireRole(roles, redirectTo = 'sale.html') {
  const user = requireAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) { window.location.href = redirectTo; return null; }
  return user;
}

// ── Invoice Number ────────────────────────────────────────────
async function getNextInvoiceNumber() {
  const today = todayStr();
  let counter = await dbGet('counter', 1);
  if (!counter) counter = { id: 1, number: 1, lastReset: today };
  if (counter.lastReset !== today) {
    counter.number = 1;
    counter.lastReset = today;
  }
  const num = counter.number;
  counter.number++;
  await dbPut('counter', counter);
  return '#' + String(num).padStart(3, '0');
}

async function resetDailyCounter() {
  await dbPut('counter', { id: 1, number: 1, lastReset: todayStr() });
}

// ── Date Helpers ──────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function formatDate(iso, fmt) {
  if (!iso) return '';
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  if (!fmt || fmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  if (fmt === 'YYYY/MM/DD') return `${year}/${month}/${day}`;
  return `${day}/${month}/${year}`;
}
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-DZ') + ' ' + d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d.toISOString();
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1); d.setHours(0,0,0,0);
  return d.toISOString();
}
function startOfYear() {
  const d = new Date();
  d.setMonth(0,1); d.setHours(0,0,0,0);
  return d.toISOString();
}

// ── Currency ─────────────────────────────────────────────────
let _currency = 'DA';
async function loadCurrency() {
  _currency = await getSetting('currency') || 'DA';
}
function formatMoney(amount) {
  return parseFloat(amount || 0).toFixed(2) + ' ' + _currency;
}

// ── Toast Notifications ───────────────────────────────────────
function toast(message, type = 'success', duration = 2800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, duration);
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

// ── Sidebar ───────────────────────────────────────────────────
function initSidebar() {
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');

  if (menuBtn) menuBtn.addEventListener('click', () => {
    overlay.classList.add('open');
    sidebar.classList.add('open');
  });
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Mark active nav
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') === current) item.classList.add('active');
  });

  // Load user info
  const user = getSession();
  if (user) {
    const userEl = document.getElementById('sidebarUser');
    if (userEl) userEl.textContent = '👤 ' + user.username;

    // Hide restricted items
    if (user.role === 'seller') {
      document.querySelectorAll('[data-role]').forEach(el => {
        const roles = el.dataset.role.split(',');
        if (!roles.includes('seller')) el.style.display = 'none';
      });
    }
  }
}
function closeSidebar() {
  document.getElementById('sidebarOverlay')?.classList.remove('open');
  document.getElementById('sidebar')?.classList.remove('open');
}

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  function tick() {
    const now = new Date();
    const date = now.toLocaleDateString('ar-DZ', { day:'2-digit', month:'2-digit', year:'numeric' });
    const time = now.toLocaleTimeString('ar-DZ', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
    el.textContent = `${date}  ${time}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── Store Name in Header ──────────────────────────────────────
async function loadHeaderStoreName() {
  const el = document.getElementById('headerStoreName');
  if (!el) return;
  const name = await getSetting('storeName');
  if (name) el.textContent = name;
}

// applyTheme defined in Sound/Theme block below

// ── Barcode Scanner Support ───────────────────────────────────
let barcodeBuffer = '';
let barcodeTimer = null;
function initBarcodeScanner(onScan) {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) onScan(barcodeBuffer);
      barcodeBuffer = '';
      clearTimeout(barcodeTimer);
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(() => { barcodeBuffer = ''; }, 100);
    }
  });
}

// ── Virtual Keyboard ──────────────────────────────────────────
let vkbTarget = null;
function initVirtualKeyboard() {
  const overlay = document.getElementById('vkbOverlay');
  if (!overlay) return;

  document.addEventListener('focusin', async (e) => {
    const touchKb = await getSetting('touchKeyboard');
    if (touchKb !== '1') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.target.type === 'date' || e.target.type === 'file') return;
      vkbTarget = e.target;
      overlay.classList.add('open');
    }
  });
}

function vkbPress(key) {
  if (!vkbTarget) return;
  if (key === '⌫') {
    const val = vkbTarget.value;
    vkbTarget.value = val.slice(0, -1);
  } else if (key === ' ') {
    vkbTarget.value += ' ';
  } else {
    vkbTarget.value += key;
  }
  vkbTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

function vkbClose() {
  document.getElementById('vkbOverlay')?.classList.remove('open');
  vkbTarget = null;
}

// ── CSV Export ────────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data.length) return toast('لا توجد بيانات للتصدير', 'warning');
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ── CSV Import ────────────────────────────────────────────────
function importCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    if (lines.length < 2) return toast('الملف فارغ أو غير صالح', 'error');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
    callback(data);
  };
  reader.readAsText(file, 'UTF-8');
}

// ── CSV Template Download ─────────────────────────────────────
function downloadCSVTemplate() {
  const template = 'name,barcode,family,size,unit,buy_price,sell_price,quantity,expiry_date\n' +
    'مثال منتج,1234567890,عائلة,500ml,قطعة,100,150,50,2026-12-31\n';
  const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'products_template.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ── Backup ────────────────────────────────────────────────────
async function createBackup() {
  const stores = ['users','products','families','customers','suppliers','sales','saleItems','debts','settings'];
  const backup = {};
  for (const store of stores) {
    backup[store] = await dbGetAll(store);
  }
  backup.timestamp = new Date().toISOString();
  backup.version = '2.0.0';
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `POSDZ_backup_${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('تم إنشاء النسخة الاحتياطية بنجاح ✅', 'success');
}

// ── Thermal Print ────────────────────────────────────────────
async function printInvoice(sale, items) {
  const storeName    = await getSetting('storeName') || '';
  const storePhone   = await getSetting('storePhone') || '';
  const storeAddress = await getSetting('storeAddress') || '';
  const welcome      = await getSetting('storeWelcome') || '';
  const currency     = await getSetting('currency') || 'DA';
  const storeLogo    = await getSetting('storeLogo') || '';
  const paperSize    = await getSetting('paperSize') || '80mm';
  const printLogo    = await getSetting('printLogo') === '1';
  const printName    = await getSetting('printName') === '1';
  const printPhone   = await getSetting('printPhone') === '1';
  const printAddress = await getSetting('printAddress') === '1';
  const printWelcome = await getSetting('printWelcome') === '1';
  const printBarcode = await getSetting('printBarcode') === '1';

  // Paper width mapping
  const widthMap = { '58mm': '54mm', '80mm': '76mm', 'A5': '148mm', 'A4': '210mm' };
  const pageW = widthMap[paperSize] || '76mm';

  const now = new Date(sale.date || new Date());
  const dateStr = now.toLocaleDateString('ar-DZ');
  const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

  let html = `<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="UTF-8">
    <style>
      @page { margin: 4mm; size: ${pageW} auto; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        font-family: 'Courier New', 'Arial', monospace;
        font-size: 12px; color: #000 !important;
        background: #fff;
        width: ${pageW};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .bold { font-weight: 900 !important; }
      .big { font-size: 15px; font-weight: 900; }
      .xl { font-size: 18px; font-weight: 900; }
      .dline { border-top: 2px solid #000; margin: 5px 0; }
      .sline { border-top: 1px dashed #000; margin: 5px 0; }
      .row { display: flex; justify-content: space-between; padding: 1px 0; }
      .logo img { max-width: 70px; max-height: 70px; display: block; margin: 0 auto 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { font-weight: 900; border-bottom: 1px solid #000; padding: 3px 2px; text-align: right; font-size: 11px; }
      td { padding: 3px 2px; font-weight: 700; }
      .total-row td { font-weight: 900; font-size: 13px; border-top: 2px solid #000; }
      @media print {
        body { width: 100%; }
        * { color: #000 !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head><body>`;

  // Invoice label — clear naming for each type
  let invoiceLabel;
  if (sale.debtSettlement && sale.partialSettlement) {
    invoiceLabel = `فاتورة تسديد جزئي #${sale.invoiceNumber}`;
  } else if (sale.debtSettlement) {
    invoiceLabel = `فاتورة تسديد #${sale.invoiceNumber}`;
  } else if (sale.isDebt) {
    invoiceLabel = `فاتورة دين #${sale.invoiceNumber}`;
  } else {
    invoiceLabel = `فاتورة: #${sale.invoiceNumber}`;
  }
  html += `<div class="row bold"><span>${invoiceLabel}</span><span>${dateStr} ${timeStr}</span></div>`;
  html += `<div class="dline"></div>`;

  // Store info centered
  if (printLogo && storeLogo) html += `<div class="logo center"><img src="${storeLogo}"/></div>`;
  if (printName && storeName) html += `<div class="center xl bold">${storeName}</div>`;
  if (printPhone && storePhone) html += `<div class="center bold">📞 ${storePhone}</div>`;
  if (printAddress && storeAddress) html += `<div class="center bold">${storeAddress}</div>`;

  if (sale.customerName) {
    html += `<div class="sline"></div>`;
    html += `<div class="row"><span class="bold">الزبون:</span><span class="bold">${sale.customerName}</span></div>`;
    if (sale.customerPhone) html += `<div class="row"><span class="bold">الهاتف:</span><span class="bold">${sale.customerPhone}</span></div>`;
  }
  html += `<div class="dline"></div>`;

  // Products table
  html += `<table>
    <thead><tr><th>المنتج</th><th style="text-align:center">ك</th><th style="text-align:center">السعر</th><th style="text-align:left">المجموع</th></tr></thead>
    <tbody>`;
  items.forEach(item => {
    html += `<tr>
      <td class="bold">${item.productName}</td>
      <td style="text-align:center" class="bold">${item.quantity}</td>
      <td style="text-align:center" class="bold">${parseFloat(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:left" class="bold">${parseFloat(item.total).toFixed(2)}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  html += `<div class="dline"></div>`;

  if (sale.discount > 0) {
    html += `<div class="row bold"><span>خصم:</span><span>- ${parseFloat(sale.discount).toFixed(2)} ${currency}</span></div>`;
  }
  html += `<div class="row xl bold"><span>الإجمالي:</span><span>${parseFloat(sale.total).toFixed(2)} ${currency}</span></div>`;
  if (sale.paid && sale.paid > 0) {
    html += `<div class="row bold"><span>المدفوع:</span><span>${parseFloat(sale.paid).toFixed(2)} ${currency}</span></div>`;
    if (sale.isDebt) {
      const remaining = sale.total - sale.paid;
      html += `<div class="row bold"><span>المتبقي (دين):</span><span>${remaining.toFixed(2)} ${currency}</span></div>`;
    }
  }
  // Show updated remaining debt after partial settlement
  if (sale.remainingDebt !== undefined) {
    html += `<div class="row bold"><span>المتبقي بعد التسديد:</span><span style="color:#dc2626;">${parseFloat(sale.remainingDebt).toFixed(2)} ${currency}</span></div>`;
  } else if (sale.remainingAfterPay !== undefined) {
    html += `<div class="row bold"><span>الدين المتبقي:</span><span style="color:#dc2626;">${parseFloat(sale.remainingAfterPay).toFixed(2)} ${currency}</span></div>`;
  }

  html += `<div class="dline"></div>`;
  if (printWelcome && welcome) html += `<div class="center bold" style="font-size:13px;margin:6px 0;">${welcome}</div>`;

  // Barcode placeholder (text-based)
  if (printBarcode && sale.invoiceNumber) {
    html += `<div class="center sline" style="font-family:monospace;font-size:10px;margin-top:4px;">||||| ${sale.invoiceNumber} |||||</div>`;
  }

  html += `</body></html>`;

  const win = window.open('', '_blank', 'width=500,height=700');
  if (!win) { toast('⚠️ يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning', 4000); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); win.onafterprint = () => win.close(); };
}

// ── Barcode Label Print ───────────────────────────────────────
// Matches the preview in settings exactly — compact, clear, consistent
async function printBarcodeLabel(product) {
  const barcodeVal  = product.barcode || String(product.id);
  const storeName   = await getSetting('storeName')        || '';
  const currency    = await getSetting('currency')         || 'دج';
  const barcodeFont = await getSetting('barcodeFont')      || 'Cairo';
  const barcodeType = await getSetting('barcodeType')      || 'CODE128';
  const showStore   = await getSetting('barcodeShowStore') === '1';
  const showName    = (await getSetting('barcodeShowName'))  !== '0';
  const showPrice   = (await getSetting('barcodeShowPrice')) !== '0';

  // Build barcode bars — deterministic, uniform height for clean look
  function buildBars(code) {
    const str = String(code);
    // Use a fixed pattern based on character values for visual consistency
    const NARROW = 2, WIDE = 4, BAR_H = 36;
    let bars = '';
    // Start guard
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      // 5 bars per character: alternating black/white based on bit pattern
      for (let b = 0; b < 5; b++) {
        const isBlack = (b % 2 === 0);
        const bit     = (c >> (4 - b)) & 1;
        const w       = bit ? WIDE : NARROW;
        bars += `<div style="width:${w}px;height:${BAR_H}px;background:${isBlack?'#000':'#fff'};"></div>`;
      }
      bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    }
    // Stop guard
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    bars += `<div style="width:3px;height:${BAR_H}px;background:#000;"></div>`;
    return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:0;overflow:hidden;max-width:54mm;">${bars}</div>`;
  }

  // QR fallback (text-based simplified)
  function buildQR(code) {
    return `<div style="font-size:9px;font-family:monospace;color:#000;word-break:break-all;max-width:54mm;border:2px solid #000;padding:3px;">[QR: ${code}]</div>`;
  }

  const barsHtml = barcodeType === 'QR' ? buildQR(barcodeVal) : buildBars(barcodeVal);

  const win = window.open('', '_blank', 'width=260,height=190');
  if (!win) { toast('⚠️ يرجى السماح بالنوافذ المنبثقة', 'warning'); return; }

  win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  @page { margin:1mm; size:58mm 38mm; }
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: '${barcodeFont}', 'Cairo', Arial, sans-serif;
    background:#fff; color:#000;
    width:56mm; text-align:center; padding:2px 1px;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .s  { font-size:8px;  font-weight:800; letter-spacing:0.5px; margin-bottom:1px; }
  .n  { font-size:10px; font-weight:900; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54mm; }
  .bc { font-family:'Courier New',monospace; font-size:7px; margin:1px 0; letter-spacing:2px; color:#000; }
  .pr { font-size:12px; font-weight:900; margin-top:2px; }
  @media print { * { color:#000!important; } }
</style>
</head><body>
  ${showStore && storeName ? `<div class="s">${storeName}</div>` : ''}
  ${showName ? `<div class="n">${product.name}</div>` : ''}
  ${barsHtml}
  <div class="bc">${barcodeVal}</div>
  ${showPrice ? `<div class="pr">${parseFloat(product.sellPrice||0).toFixed(2)} ${currency}</div>` : ''}
  <script>
    window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
  <\/script>
</body></html>`);
  win.document.close();
}


// ── Sound System ─────────────────────────────────────────────
// AudioContext created lazily on first user gesture (browser requirement)
let _AC = null;
function _getAC() {
  if (_AC && _AC.state !== 'closed') {
    if (_AC.state === 'suspended') _AC.resume().catch(()=>{});
    return _AC;
  }
  try {
    _AC = new (window.AudioContext || window.webkitAudioContext)();
    return _AC;
  } catch(e) { return null; }
}

function _beep(freq=880, dur=0.12, type='sine', vol=0.4) {
  const ac = _getAC();
  if (!ac) return;
  try {
    const g = ac.createGain();
    const o = ac.createOscillator();
    const now = ac.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.connect(g); g.connect(ac.destination);
    o.start(now); o.stop(now + dur);
  } catch(e) {}
}

// Ensure context is resumed on any user interaction
document.addEventListener('click',      () => _getAC(), { passive: true });
document.addEventListener('touchstart', () => _getAC(), { passive: true });
document.addEventListener('keydown',    () => _getAC(), { passive: true });

async function playSound(type) {
  // type: 'add' | 'sell' | 'btn'
  const settingMap = { add:'soundAdd', sell:'soundSell', btn:'soundButtons' };
  try {
    const enabled = await getSetting(settingMap[type] || 'soundButtons');
    if (enabled !== '1') return;
  } catch(e) { return; }

  _getAC(); // ensure context alive
  if (type === 'add') {
    _beep(880, 0.09, 'sine', 0.4);
  } else if (type === 'sell') {
    _beep(660, 0.10, 'triangle', 0.45);
    setTimeout(() => _beep(880,  0.15, 'triangle', 0.4),  110);
    setTimeout(() => _beep(1100, 0.22, 'triangle', 0.38), 240);
  } else if (type === 'btn') {
    _beep(600, 0.06, 'square', 0.22);
  }
}

// Attach button sounds to ALL buttons/nav across the app
function initButtonSounds() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button, .btn, .nav-item, .tab-btn, .disc-pill, .theme-dot, .printer-card');
    if (!btn) return;
    if (btn.dataset.soundSkip) return; // marked as skip
    // sell/add sounds handled by their own callers — skip generic btn for those
    if (btn.classList.contains('sound-sell') || btn.classList.contains('sound-add')) return;
    playSound('btn');
  }, { passive: true });
}

// ── Theme Apply (accent + bg — fully separated) ───────────────
async function applyTheme() {
  const accent = await getSetting('themeColor') || 'blue_purple';
  const bg     = await getSetting('bgMode')     || 'dark';

  // Set on <html> so every page inherits
  const root = document.documentElement;
  root.setAttribute('data-accent', accent);
  root.setAttribute('data-bg',     bg);
  // Legacy support
  root.setAttribute('data-theme', accent === 'blue_purple' ? '' : accent);

  // Also set body background color directly for full-page coverage
  if (bg === 'light') {
    document.body.style.background = '#EAEAF2';
    document.body.style.color      = '#111122';
  } else {
    document.body.style.background = '';
    document.body.style.color      = '';
  }

  // Language + Font
  const lang = await getSetting('language') || localStorage.getItem('posdz_lang') || 'ar';
  root.lang = lang;
  root.dir  = lang === 'ar' ? 'rtl' : 'ltr';

  const font = await getSetting('appFont') || 'Cairo';
  document.body.style.fontFamily = `'${font}', 'Cairo', sans-serif`;

  const fontSize = parseInt(await getSetting('fontSize')) || 15;
  root.style.fontSize = fontSize + 'px';
}

// ── Init ──────────────────────────────────────────────────────
async function initApp() {
  await openDB();
  await applyTheme();
  await loadCurrency();
  await loadHeaderStoreName();
  startClock();
  initSidebar();
  initVirtualKeyboard();
  initButtonSounds();
}
