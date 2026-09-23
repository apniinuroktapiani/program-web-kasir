// ============================================================
// KASIR WAHANA — main.js (FINAL + QRIS + ROLE)
// ============================================================

// ---------- DATABASE ----------
const DB = {
    VERSION: "6",
    get(key) { return JSON.parse(localStorage.getItem(key) || "[]"); },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    init() {
        if (localStorage.getItem("db_version") !== this.VERSION) {
            ["users","wahana","transaksi","detail_transaksi","nextId"].forEach(k => localStorage.removeItem(k));
            localStorage.setItem("db_version", this.VERSION);
        }
        if (!localStorage.getItem("users") || this.get("users").length === 0) {
            this.set("users", [
                { id: 1, nama: "Admin Wahana", username: "admin", password: "admin123", role: "admin" },
                { id: 2, nama: "Rina", username: "rina", password: "rina123", role: "kasir" }
            ]);
        }
        if (!localStorage.getItem("wahana") || this.get("wahana").length === 0) {
            this.set("wahana", [
                { id: 1, nama_wahana: "ATV", harga: 55000, status: "aktif", emoji: "🏍️" },
                { id: 2, nama_wahana: "Kelinci", harga: 35000, status: "aktif", emoji: "🐰" },
                { id: 3, nama_wahana: "Kuda", harga: 50000, status: "aktif", emoji: "🐴" },
                { id: 4, nama_wahana: "Paintball", harga: 160000, status: "aktif", emoji: "🎯" }
            ]);
        }
        if (!localStorage.getItem("transaksi")) this.set("transaksi", []);
        if (!localStorage.getItem("detail_transaksi")) this.set("detail_transaksi", []);
        if (!localStorage.getItem("nextId")) this.set("nextId", { wahana: 5, transaksi: 1, detail: 1 });
    },
    nextId(key) {
        const n = this.get("nextId");
        const id = n[key]++;
        this.set("nextId", n);
        return id;
    }
};
DB.init();

// ---------- EMOJI ----------
const EMOJI_MAP = { atv:"🏍️", kelinci:"🐰", kuda:"🐴", paintball:"🎯", perahu:"⛵", sepeda:"🚴", panah:"🏹", ayunan:"🎠", kolam:"🏊", mobil:"🚗", motor:"🏍️", kereta:"🚂", mewarnai:"🎨", outbound:"🎪" };
function getEmoji(nama) {
    const n = (nama || "").toLowerCase();
    for (const k in EMOJI_MAP) if (n.includes(k)) return EMOJI_MAP[k];
    return "🎪";
}

// ---------- STATE ----------
let currentUser = null;
let cart = {};
let hapusTarget = { type: null, id: null };
let searchKeyword = "";
let paymentMethod = "cash";

// ---------- HELPERS ----------
const $ = (id) => document.getElementById(id);
function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
function rupiah(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
function getInitials(nama) { return (nama || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }
function formatTanggal(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function generateKode() {
    const n = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `TRX-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${Math.floor(100 + Math.random() * 900)}`;
}
function showToast(msg, type = "success") {
    const toastEl = $("liveToast"), toastMessage = $("toastMessage");
    if (!toastEl || !toastMessage) return;
    const bg = { success: "bg-success", danger: "bg-danger", warning: "bg-warning text-dark", info: "bg-info text-dark" };
    toastEl.className = `toast align-items-center text-white border-0 ${bg[type] || "bg-primary"}`;
    toastMessage.innerHTML = msg;
    bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2500 }).show();
}
function isAdmin() { return currentUser && currentUser.role === "admin"; }

// ---------- QRIS GENERATOR ----------
function generateQRIS(total) {
    const data = `QRIS|KASIR WAHANA|INDONESIA|${total}|${Date.now()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}&color=0f172a&bgcolor=ffffff&margin=2`;
}

// ============================================================
// LOGIN
// ============================================================
function loginSuccess() {
    $("loginPage").classList.add("d-none");
    $("appPage").classList.remove("d-none");
    $("userNama").textContent = currentUser.nama;
    $("userRole").textContent = currentUser.role;
    $("userAvatar").textContent = getInitials(currentUser.nama);

    const mobAvatar = $("mobileAvatar"), mobNama = $("mobileUserNama"), mobRole = $("mobileUserRole");
    if (mobAvatar) mobAvatar.textContent = getInitials(currentUser.nama);
    if (mobNama) mobNama.textContent = currentUser.nama;
    if (mobRole) mobRole.textContent = currentUser.role;

    const admin = isAdmin();
    document.querySelectorAll(".nav-wahana-link, .mobile-wahana-link").forEach(el => {
        el.style.display = admin ? "" : "none";
    });

    navigateTo("dashboard");
    muatSemuaData();
}

function initLogin() {
    const formLogin = $("formLogin"), loginError = $("loginError"), loginErrorMsg = $("loginErrorMsg");
    if (!formLogin) return;

    formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        loginError.classList.add("d-none");
        const username = $("loginUsername").value.trim();
        const password = $("loginPassword").value;

        if (!username || !password) {
            loginErrorMsg.textContent = "Username dan password wajib diisi!";
            loginError.classList.remove("d-none");
            return;
        }
        const user = DB.get("users").find(u => u.username === username);
        if (!user) {
            loginErrorMsg.textContent = "Username tidak ditemukan!";
            loginError.classList.remove("d-none");
            return;
        }
        if (user.password !== password) {
            loginErrorMsg.textContent = "Password salah!";
            loginError.classList.remove("d-none");
            return;
        }
        currentUser = user;
        sessionStorage.setItem("kasirUser", JSON.stringify(currentUser));
        loginSuccess();
        showToast(`✅ Selamat datang, ${escapeHtml(user.nama)}!`);
    });

    const savedUser = sessionStorage.getItem("kasirUser");
    if (savedUser) {
        try { currentUser = JSON.parse(savedUser); loginSuccess(); }
        catch (e) { sessionStorage.removeItem("kasirUser"); }
    }
}

function initLogout() {
    const btn = $("btnLogout");
    if (!btn) return;
    btn.addEventListener("click", () => {
        if (!confirm("Yakin ingin logout?")) return;
        sessionStorage.removeItem("kasirUser");
        currentUser = null; cart = {};
        $("appPage").classList.add("d-none");
        $("loginPage").classList.remove("d-none");
        $("formLogin").reset();
        $("loginError").classList.add("d-none");
        showToast("🚪 Anda telah logout.", "info");
    });
}

// ============================================================
// NAVIGASI
// ============================================================
function navigateTo(page) {
    if (page === "wahana" && !isAdmin()) {
        showToast("⛔ Hanya Admin yang dapat mengakses menu Wahana", "danger");
        page = "dashboard";
    }
    document.querySelectorAll(".app-page").forEach(el => el.classList.add("d-none"));
    const target = $("page-" + page);
    if (target) target.classList.remove("d-none");
    document.querySelectorAll(".nav-pills-app .nav-link").forEach(a => {
        a.classList.toggle("active", a.dataset.page === page);
    });
    if (page === "laporan") muatLaporan();
    if (page === "kasir") renderKasirGrid();
    if (page === "wahana") renderWahana();
}

function initNavigation() {
    document.querySelectorAll(".nav-pills-app .nav-link").forEach(a => {
        a.addEventListener("click", (e) => { e.preventDefault(); if (a.dataset.page) navigateTo(a.dataset.page); });
    });
    document.querySelectorAll(".btn-goto").forEach(btn => {
        btn.addEventListener("click", () => navigateTo(btn.dataset.page));
    });
}

// ============================================================
// WAHANA
// ============================================================
function renderWahana() {
    if (!isAdmin()) return;
    let list = DB.get("wahana");
    if (searchKeyword) list = list.filter(w => w.nama_wahana.toLowerCase().includes(searchKeyword.toLowerCase()));

    const container = $("wahanaList"), emptyWahana = $("emptyWahana"), jumlahWahanaText = $("jumlahWahanaText");
    if (!container) return;

    const total = DB.get("wahana").length;
    const aktif = DB.get("wahana").filter(w => w.status === "aktif").length;
    if (jumlahWahanaText) jumlahWahanaText.textContent = `${total} Wahana · ${aktif} Aktif`;

    container.innerHTML = "";
    if (list.length === 0) { if (emptyWahana) emptyWahana.classList.remove("d-none"); return; }
    if (emptyWahana) emptyWahana.classList.add("d-none");

    list.forEach((w, i) => {
        const card = document.createElement("div");
        card.className = "wahana-card";
        card.style.animationDelay = `${Math.min(i * 0.04, 0.3)}s`;
        card.innerHTML = `
            <div class="wahana-number">${i + 1}</div>
            <div class="wahana-card-emoji">${w.emoji || getEmoji(w.nama_wahana)}</div>
            <h5 class="wahana-card-name">${escapeHtml(w.nama_wahana)}</h5>
            <div class="wahana-card-price">${rupiah(w.harga)}</div>
            <div class="wahana-card-info">
                <span class="wahana-card-status ${w.status}">${w.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="wahana-card-actions">
                <button class="btn-edit-card" data-id="${w.id}">✏️ Edit</button>
                <button class="btn-delete-card" data-id="${w.id}" data-nama="${escapeHtml(w.nama_wahana)}">🗑️ Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll(".btn-edit-card").forEach(btn => {
        btn.addEventListener("click", () => bukaModalWahana(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-delete-card").forEach(btn => {
        btn.addEventListener("click", () => konfirmasiHapus("wahana", Number(btn.dataset.id), btn.dataset.nama));
    });
}

function bukaModalWahana(id = null) {
    if (!isAdmin()) { showToast("⛔ Hanya Admin yang dapat mengelola wahana", "danger"); return; }
    const formWahana = $("formWahana");
    formWahana.reset();
    formWahana.classList.remove("was-validated");
    $("wahanaId").value = "";
    if (id) {
        $("modalWahanaTitle").innerHTML = '✏️ Edit Wahana';
        $("btnSimpanWahana").innerHTML = '✅ Perbarui';
        const w = DB.get("wahana").find(x => x.id === id);
        if (w) {
            $("wahanaId").value = w.id;
            $("wahanaNama").value = w.nama_wahana;
            $("wahanaHarga").value = w.harga;
            $("wahanaStatus").value = w.status;
        }
    } else {
        $("modalWahanaTitle").innerHTML = '➕ Tambah Wahana';
        $("btnSimpanWahana").innerHTML = '✅ Simpan';
    }
    bootstrap.Modal.getOrCreateInstance($("modalWahana")).show();
}

function initWahana() {
    const btnTambah = $("btnTambahWahana");
    if (btnTambah) {
        btnTambah.addEventListener("click", () => {
            if (!isAdmin()) { showToast("⛔ Hanya Admin yang dapat menambah wahana", "danger"); return; }
            bukaModalWahana(null);
        });
    }
    const formWahana = $("formWahana");
    if (!formWahana) return;
    formWahana.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!isAdmin()) { showToast("⛔ Hanya Admin yang dapat menyimpan wahana", "danger"); return; }
        const id = $("wahanaId").value ? Number($("wahanaId").value) : null;
        const nama = $("wahanaNama").value.trim();
        const harga = parseFloat($("wahanaHarga").value) || 0;
        if (!nama || harga <= 0) { showToast("Semua field wajib diisi dengan benar!", "warning"); return; }
        const data = { nama_wahana: nama, harga, status: $("wahanaStatus").value, emoji: getEmoji(nama) };
        const list = DB.get("wahana");
        if (id) {
            const idx = list.findIndex(x => x.id === id);
            if (idx >= 0) list[idx] = { ...list[idx], ...data };
            showToast('✅ Wahana diperbarui!');
        } else {
            list.push({ id: DB.nextId("wahana"), ...data });
            showToast('✅ Wahana ditambahkan!');
        }
        DB.set("wahana", list);
        bootstrap.Modal.getInstance($("modalWahana")).hide();
        renderWahana();
        updateStats();
    });
    document.addEventListener("input", (e) => {
        if (e.target.id === "searchWahana") { searchKeyword = e.target.value.trim(); renderWahana(); }
    });
}

// ============================================================
// HAPUS
// ============================================================
function konfirmasiHapus(type, id, nama) {
    if (!isAdmin()) { showToast("⛔ Hanya Admin yang dapat menghapus data", "danger"); return; }
    hapusTarget = { type, id };
    const hapusPesan = $("hapusPesan");
    hapusPesan.innerHTML = type === "wahana"
        ? `Yakin ingin menghapus wahana <strong>${escapeHtml(nama)}</strong>?`
        : `Yakin ingin menghapus transaksi <strong>${escapeHtml(nama)}</strong>?`;
    bootstrap.Modal.getOrCreateInstance($("modalHapus")).show();
}

function initKonfirmasiHapus() {
    const btn = $("btnKonfirmasiHapus");
    if (!btn) return;
    btn.addEventListener("click", () => {
        if (!hapusTarget.id) return;
        if (!isAdmin()) {
            showToast("⛔ Hanya Admin yang dapat menghapus data", "danger");
            bootstrap.Modal.getInstance($("modalHapus")).hide();
            hapusTarget = { type: null, id: null };
            return;
        }
        if (hapusTarget.type === "wahana") {
            if (DB.get("detail_transaksi").some(d => d.wahana_id === hapusTarget.id)) {
                showToast("Wahana sudah dipakai di transaksi!", "danger");
                bootstrap.Modal.getInstance($("modalHapus")).hide();
                return;
            }
            DB.set("wahana", DB.get("wahana").filter(w => w.id !== hapusTarget.id));
            showToast('🗑️ Wahana dihapus!');
            renderWahana();
            updateStats();
        } else {
            DB.set("detail_transaksi", DB.get("detail_transaksi").filter(d => d.transaksi_id !== hapusTarget.id));
            DB.set("transaksi", DB.get("transaksi").filter(t => t.id !== hapusTarget.id));
            showToast('🗑️ Transaksi dihapus!');
            muatLaporan();
            updateStats();
        }
        bootstrap.Modal.getInstance($("modalHapus")).hide();
        hapusTarget = { type: null, id: null };
    });
}

// ============================================================
// KASIR
// ============================================================
function renderKasirGrid() {
    const list = DB.get("wahana").filter(w => w.status === "aktif");
    const grid = $("wahanaGrid"), emptyKasir = $("emptyWahanaKasir"), badge = $("badgeJumlahWahana");
    if (!grid) return;
    grid.innerHTML = "";
    if (badge) badge.textContent = `${list.length} tersedia`;
    if (list.length === 0) { if (emptyKasir) emptyKasir.classList.remove("d-none"); return; }
    if (emptyKasir) emptyKasir.classList.add("d-none");
    list.forEach(w => {
        const div = document.createElement("div");
        div.className = "wahana-item";
        div.innerHTML = `
            <span class="wahana-emoji">${w.emoji || getEmoji(w.nama_wahana)}</span>
            <div class="wahana-name">${escapeHtml(w.nama_wahana)}</div>
            <div class="wahana-price">${rupiah(w.harga)}</div>
        `;
        div.addEventListener("click", () => tambahItem(w.id, w.nama_wahana, w.harga));
        grid.appendChild(div);
    });
}

function tambahItem(id, nama, harga) {
    if (cart[id]) cart[id].jumlah++;
    else cart[id] = { id, nama, harga, jumlah: 1 };
    renderCart();
}
function kurangiItem(id) { if (!cart[id]) return; cart[id].jumlah--; if (cart[id].jumlah <= 0) delete cart[id]; renderCart(); }
function hapusItem(id) { delete cart[id]; renderCart(); }
function hitungTotalCart() { let t = 0; Object.values(cart).forEach(it => t += it.harga * it.jumlah); return t; }

function renderCart() {
    const keys = Object.keys(cart);
    const cartList = $("cartList"), badgeItem = $("badgeJumlahItem");
    if (!cartList) return;
    if (badgeItem) badgeItem.textContent = `${keys.length} item`;

    if (keys.length === 0) {
        cartList.innerHTML = `
            <div class="cart-empty">
                <div class="empty-icon-cart">🛒</div>
                <p>Keranjang masih kosong</p>
                <small>Klik wahana untuk menambahkan</small>
            </div>`;
        $("cartTotal").textContent = "Rp 0";
        $("cartKembalian").textContent = "Rp 0";
        if (paymentMethod === "qris") updateQRISDisplay();
        return;
    }

    let html = "";
    keys.forEach(k => {
        const it = cart[k];
        const sub = it.harga * it.jumlah;
        html += `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(it.nama)}</div>
                    <div class="item-detail">${rupiah(it.harga)} × ${it.jumlah}</div>
                </div>
                <div class="item-right">
                    <div class="item-subtotal">${rupiah(sub)}</div>
                    <div>
                        <button class="qty-btn me-1 btn-kurang" data-id="${k}">−</button>
                        <button class="qty-btn me-1 btn-tambah" data-id="${k}">+</button>
                        <button class="qty-btn danger btn-hapus" data-id="${k}">×</button>
                    </div>
                </div>
            </div>`;
    });
    cartList.innerHTML = html;

    cartList.querySelectorAll(".btn-kurang").forEach(b => b.addEventListener("click", () => kurangiItem(Number(b.dataset.id))));
    cartList.querySelectorAll(".btn-tambah").forEach(b => b.addEventListener("click", () => { const it = cart[b.dataset.id]; tambahItem(it.id, it.nama, it.harga); }));
    cartList.querySelectorAll(".btn-hapus").forEach(b => b.addEventListener("click", () => hapusItem(Number(b.dataset.id))));

    const total = hitungTotalCart();
    $("cartTotal").textContent = rupiah(total);
    if (paymentMethod === "qris") updateQRISDisplay();
    hitungKembalian();
}

function hitungKembalian() {
    const inputBayar = $("inputBayar"), cartKembalian = $("cartKembalian"), rowKembalian = $("rowKembalian");
    if (!inputBayar || !cartKembalian) return;
    if (paymentMethod === "qris") { if (rowKembalian) rowKembalian.style.display = "none"; return; }
    if (rowKembalian) rowKembalian.style.display = "";
    const bayar = parseFloat(inputBayar.value) || 0;
    const kembali = bayar - hitungTotalCart();
    cartKembalian.textContent = rupiah(kembali >= 0 ? kembali : 0);
}

function updateQRISDisplay() {
    const qrisImage = $("qrisImage"), qrisAmount = $("qrisAmount");
    if (!qrisImage || !qrisAmount) return;
    const total = hitungTotalCart();
    if (total <= 0) { qrisImage.src = ""; qrisAmount.textContent = "Rp 0"; return; }
    qrisImage.src = generateQRIS(total);
    qrisAmount.textContent = rupiah(total);
}

function setPaymentMethod(method) {
    paymentMethod = method;
    document.querySelectorAll(".payment-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.method === method));
    const cashWrapper = $("cashInputWrapper"), qrisWrapper = $("qrisWrapper");
    if (method === "qris") {
        cashWrapper?.classList.add("d-none");
        qrisWrapper?.classList.remove("d-none");
        updateQRISDisplay();
    } else {
        cashWrapper?.classList.remove("d-none");
        qrisWrapper?.classList.add("d-none");
    }
    hitungKembalian();
}

function tampilkanStruk(trx) {
    const strukBody = $("strukBody");
    if (!strukBody) return;
    let itemHtml = "";
    trx.items.forEach(it => {
        itemHtml += `
            <div class="item-block">
                <div class="item-name">${escapeHtml(it.nama)}</div>
                <div class="row-line">
                    <span>${rupiah(it.harga)} × ${it.jumlah}</span>
                    <span>${rupiah(it.harga * it.jumlah)}</span>
                </div>
            </div>`;
    });
    strukBody.innerHTML = `
        <div class="struk-box">
            <div class="struk-header">
                <span class="emoji-logo">🎪</span>
                <h5>KASIR WAHANA</h5>
                <small>Tiket Wahana Rekreasi</small>
            </div>
            <div style="padding-top:.75rem;">
                <div class="row-line"><span>Kode</span><strong>${escapeHtml(trx.kode_transaksi)}</strong></div>
                <div class="row-line"><span>Tanggal</span><span>${formatTanggal(trx.tanggal)}</span></div>
                <div class="row-line"><span>Kasir</span><span>${escapeHtml(trx.nama_kasir)}</span></div>
                <div class="row-line"><span>Metode</span><strong>${trx.metode === 'qris' ? '📱 QRIS' : '💵 Cash'}</strong></div>
            </div>
            <hr>
            ${itemHtml}
            <hr>
            <div class="row-line"><span>Subtotal</span><span>${rupiah(trx.total)}</span></div>
            <div class="total-row"><span>TOTAL</span><span>${rupiah(trx.total)}</span></div>
            <hr>
            <div class="row-line"><span>Bayar</span><span>${rupiah(trx.bayar)}</span></div>
            <div class="row-line"><span>Kembalian</span><strong style="color:#059669;">${rupiah(trx.kembalian)}</strong></div>
            <div class="struk-footer">
                <p style="margin:0;">Terima kasih telah berkunjung!</p>
                <p style="margin:0;">Selamat bermain 🎉</p>
            </div>
        </div>
    `;
    bootstrap.Modal.getOrCreateInstance($("modalStruk")).show();
}

function initKasir() {
    const inputBayar = $("inputBayar");
    if (inputBayar) inputBayar.addEventListener("input", hitungKembalian);

    document.querySelectorAll(".payment-tab").forEach(tab => {
        tab.addEventListener("click", () => setPaymentMethod(tab.dataset.method));
    });

    const btnSimpan = $("btnSimpanTransaksi");
    if (!btnSimpan) return;

    btnSimpan.addEventListener("click", () => {
        const keys = Object.keys(cart);
        if (keys.length === 0) { showToast("Keranjang masih kosong!", "warning"); return; }
        const total = hitungTotalCart();
        let bayar, kembalian;
        if (paymentMethod === "qris") {
            bayar = total; kembalian = 0;
        } else {
            bayar = parseFloat($("inputBayar").value) || 0;
            if (bayar < total) { showToast("Uang bayar kurang!", "danger"); return; }
            kembalian = bayar - total;
        }
        const kode = generateKode();
        const trxId = DB.nextId("transaksi");
        const trxList = DB.get("transaksi");
        trxList.push({ id: trxId, kode_transaksi: kode, user_id: currentUser.id, nama_kasir: currentUser.nama, metode: paymentMethod, tanggal: new Date().toISOString(), total, bayar, kembalian });
        DB.set("transaksi", trxList);

        const detailList = DB.get("detail_transaksi");
        Object.values(cart).forEach(it => {
            detailList.push({ id: DB.nextId("detail"), transaksi_id: trxId, wahana_id: it.id, nama_wahana: it.nama, jumlah: it.jumlah, harga: it.harga, subtotal: it.harga * it.jumlah });
        });
        DB.set("detail_transaksi", detailList);

        tampilkanStruk({ kode_transaksi: kode, nama_kasir: currentUser.nama, metode: paymentMethod, tanggal: new Date().toISOString(), total, bayar, kembalian, items: Object.values(cart) });

        cart = {};
        $("inputBayar").value = "";
        renderCart();
        showToast('✅ Transaksi disimpan!');
        updateStats();
    });

    setPaymentMethod("cash");
}

// ============================================================
// LAPORAN
// ============================================================
function muatLaporan() {
    const filterDari = $("filterDari"), filterSampai = $("filterSampai");
    const container = $("laporanList"), emptyLaporan = $("emptyLaporan");
    const lapJumlah = $("lapJumlah"), lapPendapatan = $("lapPendapatan"), lapJumlahBadge = $("lapJumlahBadge");
    if (!container) return;

    if (!filterDari.value) { const d = new Date(); d.setDate(1); filterDari.value = d.toISOString().split("T")[0]; }
    if (!filterSampai.value) filterSampai.value = new Date().toISOString().split("T")[0];

    const dari = new Date(filterDari.value + "T00:00:00");
    const sampai = new Date(filterSampai.value + "T23:59:59");
    const rows = DB.get("transaksi").filter(t => {
        const tgl = new Date(t.tanggal);
        return tgl >= dari && tgl <= sampai;
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    container.innerHTML = "";
    if (rows.length === 0) {
        if (emptyLaporan) emptyLaporan.classList.remove("d-none");
        lapJumlah.textContent = "0";
        lapPendapatan.textContent = "Rp 0";
        if (lapJumlahBadge) lapJumlahBadge.textContent = "0 transaksi";
        return;
    }
    if (emptyLaporan) emptyLaporan.classList.add("d-none");

    let totalPendapatan = 0;
    rows.forEach(r => totalPendapatan += r.total || 0);
    lapJumlah.textContent = rows.length;
    lapPendapatan.textContent = rupiah(totalPendapatan);
    if (lapJumlahBadge) lapJumlahBadge.textContent = `${rows.length} transaksi`;

    const showDeleteBtn = isAdmin();

    rows.forEach((r, i) => {
        const card = document.createElement("div");
        card.className = "trx-card";
        card.style.animationDelay = `${Math.min(i * 0.04, 0.3)}s`;
        const isQRIS = r.metode === "qris";
        card.innerHTML = `
            <div class="trx-card-header">
                <div class="kode-wrapper">
                    <div class="trx-kode">${escapeHtml(r.kode_transaksi)}</div>
                    <div class="trx-tanggal">🕐 ${formatTanggal(r.tanggal)}</div>
                </div>
                <div class="trx-total-wrapper">
                    <div class="trx-total-label">Total</div>
                    <div class="trx-total-value">${rupiah(r.total)}</div>
                </div>
            </div>
            <div class="trx-card-body">
                <div class="trx-kasir-avatar">${getInitials(r.nama_kasir)}</div>
                <div class="trx-kasir-info">
                    <div class="trx-kasir-name">${escapeHtml(r.nama_kasir || "-")}</div>
                    <div class="trx-kasir-role">Kasir</div>
                </div>
                <div class="trx-badge" style="${isQRIS ? 'background:rgba(6,182,212,0.1);color:#0284c7;border-color:rgba(6,182,212,0.2);' : ''}">
                    ${isQRIS ? '📱 QRIS' : '💵 Cash'}
                </div>
            </div>
            <div class="trx-card-actions" style="${showDeleteBtn ? '' : 'grid-template-columns:1fr;'}">
                <button class="trx-btn trx-btn-view" data-id="${r.id}">👁️ Lihat Struk</button>
                ${showDeleteBtn ? `<button class="trx-btn trx-btn-delete" data-id="${r.id}" data-kode="${escapeHtml(r.kode_transaksi)}">🗑️ Hapus</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll(".trx-btn-view").forEach(btn => {
        btn.addEventListener("click", () => lihatStrukLama(Number(btn.dataset.id)));
    });
    if (showDeleteBtn) {
        container.querySelectorAll(".trx-btn-delete").forEach(btn => {
            btn.addEventListener("click", () => konfirmasiHapus("transaksi", Number(btn.dataset.id), btn.dataset.kode));
        });
    }
}

function lihatStrukLama(trxId) {
    const trx = DB.get("transaksi").find(t => t.id === trxId);
    if (!trx) return;
    const items = DB.get("detail_transaksi").filter(d => d.transaksi_id === trxId).map(d => ({ nama: d.nama_wahana, harga: d.harga, jumlah: d.jumlah }));
    tampilkanStruk({ ...trx, items });
}

function initLaporan() {
    const btnFilter = $("btnFilter");
    if (btnFilter) btnFilter.addEventListener("click", muatLaporan);
}

// ============================================================
// STATISTIK
// ============================================================
function updateStats() {
    const statWahana = $("statWahana");
    if (!statWahana) return;
    statWahana.textContent = DB.get("wahana").filter(w => w.status === "aktif").length;
    const trx = DB.get("transaksi");
    const todayStr = new Date().toDateString();
    let totalPendapatan = 0, hariIni = 0;
    trx.forEach(t => {
        totalPendapatan += t.total || 0;
        if (new Date(t.tanggal).toDateString() === todayStr) hariIni++;
    });
    $("statTransaksi").textContent = trx.length;
    $("statHariIni").textContent = hariIni;
    $("statPendapatan").textContent = rupiah(totalPendapatan);
}

function muatSemuaData() { renderWahana(); updateStats(); }

// ============================================================
// MOBILE DRAWER
// ============================================================
function initMobileDrawer() {
    const menuBtn = $("mobileMenuBtn"), drawer = $("mobileDrawer"), overlay = $("mobileDrawerOverlay"), closeBtn = $("mobileDrawerClose");
    if (!menuBtn || !drawer) return;
    const openDrawer = () => { drawer.classList.add("open"); overlay?.classList.add("open"); document.body.style.overflow = "hidden"; };
    const closeDrawer = () => { drawer.classList.remove("open"); overlay?.classList.remove("open"); document.body.style.overflow = ""; };
    menuBtn.addEventListener("click", openDrawer);
    closeBtn?.addEventListener("click", closeDrawer);
    overlay?.addEventListener("click", closeDrawer);
    document.querySelectorAll(".mobile-nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) {
                navigateTo(page);
                closeDrawer();
                document.querySelectorAll(".mobile-nav-link").forEach(l => l.classList.remove("active"));
                link.classList.add("active");
            }
        });
    });
    $("mobileLogout")?.addEventListener("click", () => { closeDrawer(); $("btnLogout")?.click(); });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initLogout();
    initNavigation();
    initWahana();
    initKonfirmasiHapus();
    initKasir();
    initLaporan();
    initMobileDrawer();
    if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark-mode");
    console.log("✅ Kasir Wahana + QRIS siap!");
});