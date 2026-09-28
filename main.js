// ============================================================
// KASIR WAHANA — MAIN JS
// ============================================================

// ---------- DATABASE (localStorage) ----------
const DB = {
  VERSION: "1",
  get(k){ return JSON.parse(localStorage.getItem(k) || "[]"); },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  init(){
    if(localStorage.getItem("db_ver") !== this.VERSION){
      ["users","wahana","transaksi","detail_transaksi","nextId"].forEach(k => localStorage.removeItem(k));
      localStorage.setItem("db_ver", this.VERSION);
    }
    if(!localStorage.getItem("users")){
      this.set("users", [
        {id:1, nama:"Admin Wahana", username:"admin", password:"admin123", role:"admin"},
        {id:2, nama:"Rina", username:"rina", password:"rina123", role:"kasir"}
      ]);
    }
    if(!localStorage.getItem("wahana")){
      this.set("wahana", [
        {id:1, nama_wahana:"ATV", harga:50000, status:"aktif", emoji:"🏍️"},
        {id:2, nama_wahana:"Kelinci", harga:10000, status:"aktif", emoji:"🐰"},
        {id:3, nama_wahana:"Kuda", harga:25000, status:"aktif", emoji:"🐴"},
        {id:4, nama_wahana:"Paintball", harga:75000, status:"aktif", emoji:"🎯"},
        {id:5, nama_wahana:"Panahan", harga:30000, status:"aktif", emoji:"🏹"},
        {id:6, nama_wahana:"Mobil Remote", harga:20000, status:"aktif", emoji:"🚗"},
        {id:7, nama_wahana:"Shooting Shot", harga:40000, status:"aktif", emoji:"🎯"},
        {id:8, nama_wahana:"Outbound", harga:100000, status:"aktif", emoji:"🎪"}
      ]);
    }
    if(!localStorage.getItem("transaksi")) this.set("transaksi", []);
    if(!localStorage.getItem("detail_transaksi")) this.set("detail_transaksi", []);
    if(!localStorage.getItem("nextId")) this.set("nextId", {wahana:9, transaksi:1, detail:1});
  },
  nextId(k){
    const n = this.get("nextId");
    const id = n[k]++;
    this.set("nextId", n);
    return id;
  }
};
DB.init();

// ---------- STATE ----------
let currentUser = null;
let cart = {};
let paymentMethod = "cash";
let hapusTarget = { type: null, id: null };
let strukTerakhir = null;

// ---------- HELPERS ----------
const $ = (id) => document.getElementById(id);

function esc(t){
  const d = document.createElement("div");
  d.textContent = t == null ? "" : t;
  return d.innerHTML;
}
function rp(n){ return "Rp " + Number(n||0).toLocaleString("id-ID"); }
function ini(n){ return (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function fmtTgl(iso){
  if(!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) +
         " " + d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
}
function genKode(){
  const n = new Date(), p = x => String(x).padStart(2,"0");
  return `TRX-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${Math.floor(100+Math.random()*900)}`;
}
function isAdmin(){ return currentUser && currentUser.role === "admin"; }

function toast(msg, type = "success"){
  const c = $("toastWrap");
  const t = document.createElement("div");
  t.className = "toast-msg" + (type === "danger" ? " danger" : type === "warning" ? " warning" : "");
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ============================================================
// LOGIN
// ============================================================
function initLogin(){
  const form = $("formLogin");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("loginError"), msg = $("loginErrorMsg");
    err.classList.add("hide");

    const u = $("loginUsername").value.trim();
    const p = $("loginPassword").value;

    if(!u || !p){
      msg.textContent = "Username dan password wajib diisi!";
      err.classList.remove("hide");
      return;
    }
    const user = DB.get("users").find(x => x.username === u);
    if(!user){
      msg.textContent = "Username tidak ditemukan!";
      err.classList.remove("hide");
      return;
    }
    if(user.password !== p){
      msg.textContent = "Password salah!";
      err.classList.remove("hide");
      return;
    }

    currentUser = user;
    sessionStorage.setItem("kasirUser", JSON.stringify(user));
    loginSuccess();
  });

  // Auto login
  const saved = sessionStorage.getItem("kasirUser");
  if(saved){
    try{
      currentUser = JSON.parse(saved);
      loginSuccess();
    } catch(e){
      sessionStorage.removeItem("kasirUser");
    }
  }
}

function loginSuccess(){
  $("loginPage").classList.add("hide");
  $("appPage").classList.remove("hide");
  $("userNama").textContent = currentUser.nama;
  $("userRole").textContent = currentUser.role;
  $("userAvatar").textContent = ini(currentUser.nama);
  $("drawerNama").textContent = currentUser.nama;
  $("drawerRole").textContent = currentUser.role;
  $("drawerAvatar").textContent = ini(currentUser.nama);

  // Sembunyikan menu Wahana untuk kasir
  const admin = isAdmin();
  document.querySelectorAll(".nav-admin, .drawer-admin").forEach(el => {
    el.style.display = admin ? "" : "none";
  });

  navigateTo("dashboard");
  refreshStats();
}

function initLogout(){
  $("btnLogout").addEventListener("click", doLogout);
  $("drawerLogout").addEventListener("click", () => {
    closeDrawer();
    doLogout();
  });
}

function doLogout(){
  if(!confirm("Yakin ingin logout?")) return;
  sessionStorage.removeItem("kasirUser");
  currentUser = null;
  cart = {};
  $("appPage").classList.add("hide");
  $("loginPage").classList.remove("hide");
  $("formLogin").reset();
  $("loginError").classList.add("hide");
}

// ============================================================
// NAVIGASI
// ============================================================
function navigateTo(page){
  if(page === "wahana" && !isAdmin()){
    toast("⛔ Hanya Admin", "danger");
    page = "dashboard";
  }
  document.querySelectorAll(".page").forEach(el => el.classList.add("hide"));
  const t = $("page-" + page);
  if(t) t.classList.remove("hide");

  document.querySelectorAll(".nav-menu a, .drawer-menu a").forEach(a => {
    a.classList.toggle("active", a.dataset.page === page);
  });

  if(page === "kasir") renderKasir();
  if(page === "wahana") renderWahanaList();
  if(page === "laporan") muatLaporan();
}

function initNavigation(){
  document.querySelectorAll(".nav-menu a, .drawer-menu a").forEach(a => {
    a.addEventListener("click", () => {
      if(a.dataset.page){
        navigateTo(a.dataset.page);
        closeDrawer();
      }
    });
  });
}

// ============================================================
// MOBILE DRAWER
// ============================================================
function openDrawer(){
  $("drawer").classList.add("open");
  $("drawerOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeDrawer(){
  $("drawer").classList.remove("open");
  $("drawerOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function initMobileDrawer(){
  $("mobBtn").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
}

// ============================================================
// WAHANA — CRUD (Admin)
// ============================================================
function renderWahanaList(){
  if(!isAdmin()) return;
  const list = DB.get("wahana");
  const c = $("wahanaList");
  const empty = $("emptyWahana");
  c.innerHTML = "";

  if(list.length === 0){
    empty.classList.remove("hide");
    return;
  }
  empty.classList.add("hide");

  list.forEach((w, i) => {
    const el = document.createElement("div");
    el.className = "wahana-card";
    el.style.animationDelay = Math.min(i * 0.04, 0.4) + "s";
    el.innerHTML = `
      <div class="head">
        <div class="em">${w.emoji || "🎪"}</div>
        <div class="info">
          <div class="nm">${esc(w.nama_wahana)}</div>
          <div class="pr">${rp(w.harga)}</div>
        </div>
        <span class="badge badge-${w.status === 'aktif' ? 'green' : 'gray'}">${w.status}</span>
      </div>
      <div class="actions">
        <button class="btn btn-blue btn-sm" data-action="edit" data-id="${w.id}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" data-action="del" data-id="${w.id}" data-nama="${esc(w.nama_wahana)}">🗑️ Hapus</button>
      </div>
    `;
    c.appendChild(el);
  });

  c.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      if(btn.dataset.action === "edit") bukaModalWahana(id);
      if(btn.dataset.action === "del") konfirmasiHapus("wahana", id, btn.dataset.nama);
    });
  });
}

function bukaModalWahana(id = null){
  if(!isAdmin()) return;
  const form = $("formWahana");
  form.reset();
  $("wahanaId").value = "";

  if(id){
    $("modalWahanaTitle").textContent = "✏️ Edit Wahana";
    $("btnSimpanWahana").textContent = "✅ Perbarui";
    const w = DB.get("wahana").find(x => x.id === id);
    if(w){
      $("wahanaId").value = w.id;
      $("wahanaNama").value = w.nama_wahana;
      $("wahanaHarga").value = w.harga;
      $("wahanaStatus").value = w.status;
    }
  } else {
    $("modalWahanaTitle").textContent = "➕ Tambah Wahana";
    $("btnSimpanWahana").textContent = "💾 Simpan";
  }
  openModal("modalWahana");
}

function initWahana(){
  $("btnTambahWahana").addEventListener("click", () => bukaModalWahana(null));

  $("formWahana").addEventListener("submit", (e) => {
    e.preventDefault();
    if(!isAdmin()) return;

    const id = $("wahanaId").value ? Number($("wahanaId").value) : null;
    const nama = $("wahanaNama").value.trim();
    const harga = parseFloat($("wahanaHarga").value) || 0;

    if(!nama || harga <= 0){
      toast("⚠️ Field wajib diisi!", "warning");
      return;
    }

    const EMOJI_MAP = {
      atv:"🏍️",kelinci:"🐰",kuda:"🐴",paintball:"🎯",panahan:"🏹",
      mobil:"🚗",shooting:"🎯",outbound:"🎪",perahu:"⛵",sepeda:"🚴"
    };
    let emoji = "🎪";
    const lower = nama.toLowerCase();
    for(const k in EMOJI_MAP){
      if(lower.includes(k)){ emoji = EMOJI_MAP[k]; break; }
    }

    const data = {
      nama_wahana: nama,
      harga: harga,
      status: $("wahanaStatus").value,
      emoji: emoji
    };

    const list = DB.get("wahana");
    if(id){
      const i = list.findIndex(x => x.id === id);
      if(i >= 0) list[i] = { ...list[i], ...data };
      toast("✅ Wahana diperbarui");
    } else {
      list.push({ id: DB.nextId("wahana"), ...data });
      toast("✅ Wahana ditambahkan");
    }
    DB.set("wahana", list);
    closeModal("modalWahana");
    renderWahanaList();
    refreshStats();
  });
}

// ============================================================
// HAPUS
// ============================================================
function konfirmasiHapus(type, id, nama){
  if(!isAdmin()){
    toast("⛔ Hanya Admin", "danger");
    return;
  }
  hapusTarget = { type, id };
  $("hapusPesan").innerHTML = type === "wahana"
    ? `Yakin hapus wahana <strong>${esc(nama)}</strong>?`
    : `Yakin hapus transaksi <strong>${esc(nama)}</strong>?`;
  openModal("modalHapus");
}

function initKonfirmasiHapus(){
  $("btnKonfirmasiHapus").addEventListener("click", () => {
    if(!hapusTarget.id) return;
    if(!isAdmin()){ toast("⛔ Hanya Admin", "danger"); return; }

    if(hapusTarget.type === "wahana"){
      const detail = DB.get("detail_transaksi");
      if(detail.some(d => d.wahana_id === hapusTarget.id)){
        toast("⚠️ Wahana dipakai di transaksi", "warning");
        closeModal("modalHapus");
        return;
      }
      DB.set("wahana", DB.get("wahana").filter(w => w.id !== hapusTarget.id));
      toast("🗑️ Wahana dihapus");
      renderWahanaList();
      refreshStats();
    } else {
      DB.set("detail_transaksi", DB.get("detail_transaksi").filter(d => d.transaksi_id !== hapusTarget.id));
      DB.set("transaksi", DB.get("transaksi").filter(t => t.id !== hapusTarget.id));
      toast("🗑️ Transaksi dihapus");
      muatLaporan();
      refreshStats();
    }
    closeModal("modalHapus");
    hapusTarget = { type: null, id: null };
  });
}

// ============================================================
// KASIR
// ============================================================
function renderKasir(){
  const list = DB.get("wahana").filter(w => w.status === "aktif");
  const g = $("wahanaGrid");
  const empty = $("emptyWahanaKasir");
  g.innerHTML = "";

  if(list.length === 0){
    empty.classList.remove("hide");
    return;
  }
  empty.classList.add("hide");

  list.forEach((w, i) => {
    const el = document.createElement("div");
    el.className = "wahana-item";
    el.style.animationDelay = Math.min(i * 0.04, 0.4) + "s";
    el.innerHTML = `
      <span class="em">${w.emoji || "🎪"}</span>
      <div class="nm">${esc(w.nama_wahana)}</div>
      <div class="pr">${rp(w.harga)}</div>
    `;
    el.addEventListener("click", () => tambahItem(w.id, w.nama_wahana, w.harga));
    g.appendChild(el);
  });
}

function tambahItem(id, nama, harga){
  if(cart[id]) cart[id].jumlah++;
  else cart[id] = { id, nama, harga, jumlah: 1 };
  renderCart();
}
function kurangiItem(id){
  if(!cart[id]) return;
  cart[id].jumlah--;
  if(cart[id].jumlah <= 0) delete cart[id];
  renderCart();
}
function hapusItem(id){
  delete cart[id];
  renderCart();
}
function totalCart(){
  let t = 0;
  Object.values(cart).forEach(it => t += it.harga * it.jumlah);
  return t;
}

function renderCart(){
  const keys = Object.keys(cart);
  const list = $("cartList");
  $("cartCount").textContent = keys.length;

  if(keys.length === 0){
    list.innerHTML = `
      <div class="empty" style="padding:2rem 1rem;">
        <div class="ic">🛒</div>
        <p>Keranjang masih kosong</p>
      </div>`;
    $("cartTotal").textContent = "Rp 0";
    $("rowKembalian").style.display = "none";
    if(paymentMethod === "qris") updateQRIS();
    return;
  }

  let html = "";
  keys.forEach(k => {
    const it = cart[k];
    const sub = it.harga * it.jumlah;
    html += `
      <div class="cart-item">
        <div>
          <div class="nm">${esc(it.nama)}</div>
          <div class="dt">${rp(it.harga)} × ${it.jumlah} = <b style="color:#f59e0b;">${rp(sub)}</b></div>
        </div>
        <div style="display:flex;gap:.3rem;">
          <button class="qty-btn" data-action="min" data-id="${k}">−</button>
          <button class="qty-btn" data-action="plus" data-id="${k}">+</button>
          <button class="qty-btn del" data-action="del" data-id="${k}">×</button>
        </div>
      </div>`;
  });
  list.innerHTML = html;

  list.querySelectorAll(".qty-btn").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      if(b.dataset.action === "min") kurangiItem(id);
      if(b.dataset.action === "plus"){ const it = cart[id]; tambahItem(it.id, it.nama, it.harga); }
      if(b.dataset.action === "del") hapusItem(id);
    });
  });

  $("cartTotal").textContent = rp(totalCart());
  if(paymentMethod === "qris") updateQRIS();
  hitungKembalian();
}

function hitungKembalian(){
  const total = totalCart();
  const bayar = parseFloat($("inputBayar").value) || 0;
  const row = $("rowKembalian");
  const box = $("cartKembalian");

  if(paymentMethod !== "cash" || total <= 0 || bayar <= 0){
    row.style.display = "none";
    return;
  }
  row.style.display = "flex";
  const kembali = bayar - total;
  if(kembali >= 0){
    box.style.color = "#059669";
    box.textContent = rp(kembali);
  } else {
    box.style.color = "#dc2626";
    box.textContent = "-" + rp(Math.abs(kembali));
  }
}

function initKasir(){
  $("inputBayar").addEventListener("input", hitungKembalian);

  document.querySelectorAll(".pay-tab").forEach(tab => {
    tab.addEventListener("click", () => setPayMethod(tab.dataset.method));
  });

  $("btnSimpanTrx").addEventListener("click", simpanTransaksi);
}

function setPayMethod(m){
  paymentMethod = m;
  document.querySelectorAll(".pay-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.method === m);
  });

  if(m === "qris"){
    $("cashWrap").classList.add("hide");
    $("qrisWrap").classList.remove("hide");
    updateQRIS();
  } else {
    $("cashWrap").classList.remove("hide");
    $("qrisWrap").classList.add("hide");
  }
  hitungKembalian();
}

function updateQRIS(){
  const total = totalCart();
  const img = $("qrisImage");
  const amt = $("qrisAmount");

  if(total <= 0){
    img.src = "";
    amt.textContent = "Rp 0";
    return;
  }
  const data = `QRIS-KASIR-WAHANA-${total}-${Date.now()}`;
  img.src = `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=250&margin=2&ecLevel=M&dark=0f172a&light=ffffff`;
  amt.textContent = rp(total);
}

function simpanTransaksi(){
  const keys = Object.keys(cart);
  if(keys.length === 0){
    toast("⚠️ Keranjang kosong!", "warning");
    return;
  }

  const total = totalCart();
  let bayar, kembalian;

  if(paymentMethod === "qris"){
    bayar = total;
    kembalian = 0;
  } else {
    bayar = parseFloat($("inputBayar").value) || 0;
    if(bayar < total){
      toast("⚠️ Uang bayar kurang!", "danger");
      return;
    }
    kembalian = bayar - total;
  }

  const kode = genKode();
  const trxId = DB.nextId("transaksi");

  const trxList = DB.get("transaksi");
  trxList.push({
    id: trxId,
    kode_transaksi: kode,
    user_id: currentUser.id,
    nama_kasir: currentUser.nama,
    metode: paymentMethod,
    tanggal: new Date().toISOString(),
    total, bayar, kembalian
  });
  DB.set("transaksi", trxList);

  const detailList = DB.get("detail_transaksi");
  Object.values(cart).forEach(it => {
    detailList.push({
      id: DB.nextId("detail"),
      transaksi_id: trxId,
      wahana_id: it.id,
      nama_wahana: it.nama,
      jumlah: it.jumlah,
      harga: it.harga,
      subtotal: it.harga * it.jumlah
    });
  });
  DB.set("detail_transaksi", detailList);

  strukTerakhir = { kode_transaksi: kode, nama_kasir: currentUser.nama, metode: paymentMethod, tanggal: new Date().toISOString(), total, bayar, kembalian, items: Object.values(cart) };
  tampilkanStruk(strukTerakhir);

  cart = {};
  $("inputBayar").value = "";
  setPayMethod("cash");
  renderCart();
  toast("✅ Transaksi disimpan");
  refreshStats();
}

// ============================================================
// STRUK
// ============================================================
function tampilkanStruk(trx){
  $("strukContent").textContent = buatTeksStruk(trx);
  openModal("modalStruk");
}

function buatTeksStruk(t){
  let items = "";
  t.items.forEach(it => {
    items += it.nama + "\n";
    items += `  ${it.jumlah} x ${Number(it.harga).toLocaleString("id-ID")} = Rp${Number(it.harga*it.jumlah).toLocaleString("id-ID")}\n`;
  });

  let teks = "";
  teks += "================================\n";
  teks += "        KASIR WAHANA\n";
  teks += "    Tiket Wahana Rekreasi\n";
  teks += "================================\n";
  teks += `Kode    : ${t.kode_transaksi}\n`;
  teks += `Tanggal : ${fmtTgl(t.tanggal)}\n`;
  teks += `Kasir   : ${t.nama_kasir}\n`;
  teks += `Metode  : ${t.metode === "qris" ? "📱 QRIS" : "💵 Cash"}\n`;
  teks += "================================\n";
  teks += items;
  teks += "================================\n";
  teks += `TOTAL     : Rp${Number(t.total).toLocaleString("id-ID")}\n`;
  teks += `Bayar     : Rp${Number(t.bayar).toLocaleString("id-ID")}\n`;
  teks += `Kembalian : Rp${Number(t.kembalian).toLocaleString("id-ID")}\n`;
  teks += "================================\n";
  teks += "  Terima kasih 🙏\n";
  teks += "    Selamat bermain!\n";
  teks += "================================\n";
  return teks;
}

function initStruk(){
  $("btnCetak").addEventListener("click", () => {
    if(!strukTerakhir) return;
    const teks = buatTeksStruk(strukTerakhir);
    const w = window.open("", "_blank", "width=400,height=600");
    w.document.write(`<html><head><title>Struk</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px}pre{white-space:pre-wrap;margin:0}@media print{@page{margin:0}}</style></head><body><pre>${teks}</pre><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  });

  $("btnWA").addEventListener("click", () => {
    if(!strukTerakhir) return;
    const teks = buatTeksStruk(strukTerakhir);
    window.open("https://wa.me/?text=" + encodeURIComponent(teks));
  });
}

// ============================================================
// LAPORAN
// ============================================================
function muatLaporan(){
  const f1 = $("filterDari"), f2 = $("filterSampai");
  if(!f1.value){ const d = new Date(); d.setDate(1); f1.value = d.toISOString().split("T")[0]; }
  if(!f2.value) f2.value = new Date().toISOString().split("T")[0];

  const dari = new Date(f1.value + "T00:00:00");
  const sampai = new Date(f2.value + "T23:59:59");

  const rows = DB.get("transaksi").filter(t => {
    const d = new Date(t.tanggal);
    return d >= dari && d <= sampai;
  }).sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

  const c = $("laporanList");
  const empty = $("emptyLaporan");
  c.innerHTML = "";

  if(rows.length === 0){
    empty.classList.remove("hide");
    $("lapJumlah").textContent = "0";
    $("lapPendapatan").textContent = "Rp 0";
    return;
  }
  empty.classList.add("hide");

  let total = 0;
  rows.forEach(r => total += r.total || 0);
  $("lapJumlah").textContent = rows.length;
  $("lapPendapatan").textContent = rp(total);

  const showDel = isAdmin();

  rows.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = "trx-card";
    card.style.animationDelay = Math.min(i * 0.04, 0.35) + "s";
    card.innerHTML = `
      <div class="trx-head">
        <div style="flex:1;min-width:0">
          <div class="trx-code">${esc(r.kode_transaksi)}</div>
          <div class="trx-date">🕐 ${fmtTgl(r.tanggal)}</div>
        </div>
        <div class="trx-total">
          <div class="lbl">Total</div>
          <div class="val">${rp(r.total)}</div>
        </div>
      </div>
      <div class="trx-body">
        <div class="trx-av">${ini(r.nama_kasir)}</div>
        <div class="trx-us">
          <div class="nm">${esc(r.nama_kasir || "-")}</div>
          <div class="rl">Kasir · ${r.metode === "qris" ? "📱 QRIS" : "💵 Cash"}</div>
        </div>
      </div>
      <div class="trx-acts ${showDel ? '' : 'one'}">
        <button class="btn btn-blue btn-sm" data-action="view" data-id="${r.id}">👁️ Struk</button>
        ${showDel ? `<button class="btn btn-danger btn-sm" data-action="del" data-id="${r.id}" data-kode="${esc(r.kode_transaksi)}">🗑️ Hapus</button>` : ''}
      </div>
    `;
    c.appendChild(card);
  });

  c.querySelectorAll("button[data-action]").forEach(b => {
    b.addEventListener("click", () => {
      const id = Number(b.dataset.id);
      if(b.dataset.action === "view") lihatStrukLama(id);
      if(b.dataset.action === "del") konfirmasiHapus("transaksi", id, b.dataset.kode);
    });
  });
}

function lihatStrukLama(id){
  const trx = DB.get("transaksi").find(t => t.id === id);
  if(!trx) return;
  const items = DB.get("detail_transaksi")
    .filter(d => d.transaksi_id === id)
    .map(d => ({ nama: d.nama_wahana, harga: d.harga, jumlah: d.jumlah }));
  strukTerakhir = { ...trx, items };
  tampilkanStruk(strukTerakhir);
}

function initLaporan(){
  $("btnFilter").addEventListener("click", muatLaporan);
}

// ============================================================
// STATISTIK
// ============================================================
function refreshStats(){
  $("statWahana").textContent = DB.get("wahana").filter(w => w.status === "aktif").length;

  const trx = DB.get("transaksi");
  const today = new Date().toDateString();
  let total = 0, hariIni = 0;
  trx.forEach(t => {
    total += t.total || 0;
    if(new Date(t.tanggal).toDateString() === today) hariIni++;
  });
  $("statTransaksi").textContent = trx.length;
  $("statHariIni").textContent = hariIni;
  $("statPendapatan").textContent = rp(total);
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id){ $(id).classList.add("active"); }
function closeModal(id){ $(id).classList.remove("active"); }

function initModals(){
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", e => {
      if(e.target === m) m.classList.remove("active");
    });
  });
}

// ============================================================
// INIT ALL
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initLogout();
  initNavigation();
  initMobileDrawer();
  initWahana();
  initKonfirmasiHapus();
  initKasir();
  initStruk();
  initLaporan();
  initModals();
  console.log("🎪 Kasir Wahana siap!");
});