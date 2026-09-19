// ============================================================
// KASIR WAHANA — main.js (VERSI BERSIH & LENGKAP)
// ============================================================

// ---------- DATABASE (localStorage) ----------
const DB = {
    VERSION: "4",
    get(key) {
        return JSON.parse(localStorage.getItem(key) || "[]");
    },
    set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    },
    init() {
        const savedVersion = localStorage.getItem("db_version");
        if (savedVersion !== this.VERSION) {
            localStorage.removeItem("users");
            localStorage.removeItem("wahana");
            localStorage.removeItem("transaksi");
            localStorage.removeItem("detail_transaksi");
            localStorage.removeItem("nextId");
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
        if (!localStorage.getItem("nextId")) {
            this.set("nextId", { wahana: 5, transaksi: 1, detail: 1 });
        }
    },
    nextId(key) {
        const n = this.get("nextId");
        const id = n[key]++;
        this.set("nextId", n);
        return id;
    }
};
DB.init();

// ---------- EMOJI MAP ----------
const EMOJI_MAP = {
    atv: "🏍️", kelinci: "🐰", kuda: "🐴", paintball: "🎯",
    perahu: "⛵", sepeda: "🚴", panah: "🏹", ayunan: "🎠",
    kolam: "🏊", mobil: "🚗", motor: "🏍️", kereta: "🚂",
    mewarnai: "🎨", outbound: "🎪"
};

function getEmoji(nama) {
    const n = (nama || "").toLowerCase();
    for (const k in EMOJI_MAP) {
        if (n.includes(k)) return EMOJI_MAP[k];
    }
    return "🎪";
}

// ---------- STATE ----------
let currentUser = null;
let cart = {};
let hapusTarget = { type: null, id: null };
let searchKeyword = "";

// ---------- DOM HELPERS ----------
const $ = (id) => document.getElementById(id);

function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : t;
    return d.innerHTML;
}

function rupiah(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function getInitials(nama) {
    return (nama || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatTanggal(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
        " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function generateKode() {
    const n = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `TRX-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${Math.floor(100 + Math.random() * 900)}`;
}

function showToast(msg, type = "success") {
    const toastEl = $("liveToast");
    const toastMessage = $("toastMessage");
    if (!toastEl || !toastMessage) return;
    const bg = { success: "bg-success", danger: "bg-danger", warning: "bg-warning text-dark", info: "bg-info text-dark" };
    toastEl.className = `toast align-items-center text-white border-0 ${bg[type] || "bg-primary"}`;
    toastMessage.innerHTML = msg;
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2500 });
    toast.show();
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

    // Mobile drawer info
    const mobAvatar = $("mobileAvatar");
    const mobNama = $("mobileUserNama");
    const mobRole = $("mobileUserRole");
    if (mobAvatar) mobAvatar.textContent = getInitials(currentUser.nama);
    if (mobNama) mobNama.textContent = currentUser.nama;
    if (mobRole) mobRole.textContent = currentUser.role;

    // Sembunyikan Wahana untuk kasir
    document.querySelectorAll(".nav-wahana-link, .mobile-wahana-link")
        .forEach(el => el.style.display = currentUser.role === "admin" ? "" : "none");

    navigateTo("dashboard");
    muatSemuaData();
}

function initLogin() {
    const formLogin = $("formLogin");
    const loginError = $("loginError");
    const loginErrorMsg = $("loginErrorMsg");

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

        const users = DB.get("users");
        const user = users.find(u => u.username === username);

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
        showToast(`<i class="bi bi-check-circle-fill me-1"></i> Selamat datang, ${escapeHtml(user.nama)}!`);
    });

    // Auto login
    const savedUser = sessionStorage.getItem("kasirUser");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            loginSuccess();
        } catch (e) {
            sessionStorage.removeItem("kasirUser");
        }
    }
}

function initLogout() {
    const btn = $("btnLogout");
    if (!btn) return;
    btn.addEventListener("click", () => {
        if (!confirm("Yakin ingin logout?")) return;
        sessionStorage.removeItem("kasirUser");
        currentUser = null;
        cart = {};
        $("appPage").classList.add("d-none");
        $("loginPage").classList.remove("d-none");
        $("formLogin").reset();
        $("loginError").classList.add("d-none");
        showToast("<i class='bi bi-box-arrow-right me-1'></i> Anda telah logout.", "info");
    });
}

// ============================================================
// NAVIGASI
// ============================================================
function navigateTo(page) {
    document.querySelectorAll(".app-page").forEach(el => el.classList.add("d-none"));
    const target = $("page-" + page);
    if (target) target.classList.remove("d-none");

    document.querySelectorAll(".navbar-nav .nav-link, .nav-pills-app .nav-link").forEach(a => {
        a.classList.toggle("active", a.dataset.page === page);
    });

    if (page === "laporan") muatLaporan();
    if (page === "kasir") renderKasirGrid();
    if (page === "wahana") renderWahana();
}

function initNavigation() {
    document.querySelectorAll(".nav-pills-app .nav-link").forEach(a => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            if (a.dataset.page) navigateTo(a.dataset.page);
        });
    });
    document.querySelectorAll(".btn-goto").forEach(btn => {
        btn.addEventListener("click", () => navigateTo(btn.dataset.page));
    });
}

// ============================================================
// WAHANA — CRUD
// ============================================================
function renderWahana() {
    let list = DB.get("wahana");
    if (searchKeyword) {
        list = list.filter(w => w.nama_wahana.toLowerCase().includes(searchKeyword.toLowerCase()));
    }

    const container = $("wahanaList");
    const emptyWahana = $("emptyWahana");
    const jumlahWahanaText = $("jumlahWahanaText");
    if (!container) return;

    const total = DB.get("wahana").length;
    const aktif = DB.get("wahana").filter(w => w.status === "aktif").length;
    if (jumlahWahanaText) jumlahWahanaText.textContent = `${total} Wahana · ${aktif} Aktif`;

    container.innerHTML = "";

    if (list.length === 0) {
        if (emptyWahana) emptyWahana.classList.remove("d-none");
        return;
    }
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
                <button class="btn-edit-card" data-id="${w.id}"><i class="bi bi-pencil-fill"></i> Edit</button>
                <button class="btn-delete-card" data-id="${w.id}" data-nama="${escapeHtml(w.nama_wahana)}"><i class="bi bi-trash-fill"></i> Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll(".btn-edit-card").forEach(btn => {
        btn.addEventListener("click", () => bukaModalWahana(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-delete-card").forEach(btn => {
        btn.addEventListener("click", () => {
            konfirmasiHapus("wahana", Number(btn.dataset.id), btn.dataset.nama);
        });
    });
}

function bukaModalWahana(id = null) {
    const formWahana = $("formWahana");
    const wahanaId = $("wahanaId");
    const wahanaNama = $("wahanaNama");
    const wahanaHarga = $("wahanaHarga");
    const wahanaStatus = $("wahanaStatus");
    const modalWahanaTitle = $("modalWahanaTitle");
    const btnSimpanWahana = $("btnSimpanWahana");

    formWahana.reset();
    formWahana.classList.remove("was-validated");
    wahanaId.value = "";

    if (id) {
        modalWahanaTitle.innerHTML = '<i class="bi bi-pencil-fill"></i> Edit Wahana';
        btnSimpanWahana.innerHTML = '<i class="bi bi-check-lg"></i> Perbarui';
        const w = DB.get("wahana").find(x => x.id === id);
        if (w) {
            wahanaId.value = w.id;
            wahanaNama.value = w.nama_wahana;
            wahanaHarga.value = w.harga;
            wahanaStatus.value = w.status;
        }
    } else {
        modalWahanaTitle.innerHTML = '<i class="bi bi-plus-circle-fill"></i> Tambah Wahana';
        btnSimpanWahana.innerHTML = '<i class="bi bi-check-lg"></i> Simpan';
    }
    bootstrap.Modal.getOrCreateInstance($("modalWahana")).show();
}

function initWahana() {
    const btnTambah = $("btnTambahWahana");
    if (btnTambah) btnTambah.addEventListener("click", () => bukaModalWahana(null));

    const formWahana = $("formWahana");
    if (!formWahana) return;

    formWahana.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = $("wahanaId").value ? Number($("wahanaId").value) : null;
        const nama = $("wahanaNama").value.trim();
        const harga = parseFloat($("wahanaHarga").value) || 0;

        if (!nama || harga <= 0) {
            showToast("Semua field wajib diisi dengan benar!", "warning");
            return;
        }

        const data = {
            nama_wahana: nama,
            harga: harga,
            status: $("wahanaStatus").value,
            emoji: getEmoji(nama)
        };

        const list = DB.get("wahana");
        if (id) {
            const idx = list.findIndex(x => x.id === id);
            if (idx >= 0) list[idx] = { ...list[idx], ...data };
            showToast('<i class="bi bi-check-circle-fill me-1"></i> Wahana diperbarui!');
        } else {
            list.push({ id: DB.nextId("wahana"), ...data });
            showToast('<i class="bi bi-check-circle-fill me-1"></i> Wahana ditambahkan!');
        }
        DB.set("wahana", list);
        bootstrap.Modal.getInstance($("modalWahana")).hide();
        renderWahana();
        updateStats();
    });

    // Search
    document.addEventListener("input", (e) => {
        if (e.target.id === "searchWahana") {
            searchKeyword = e.target.value.trim();
            renderWahana();
        }
    });
}

// ============================================================
// KONFIRMASI HAPUS
// ============================================================
function konfirmasiHapus(type, id, nama) {
    hapusTarget = { type, id };
    const hapusPesan = $("hapusPesan");
    if (type === "wahana") {
        hapusPesan.innerHTML = `Yakin ingin menghapus wahana <strong>${escapeHtml(nama)}</strong>?<br><small class="text-muted">Tidak dapat dibatalkan.</small>`;
    } else {
        hapusPesan.innerHTML = `Yakin ingin menghapus transaksi <strong>${escapeHtml(nama)}</strong>?<br><small class="text-muted">Tidak dapat dibatalkan.</small>`;
    }
    bootstrap.Modal.getOrCreateInstance($("modalHapus")).show();
}

function initKonfirmasiHapus() {
    const btn = $("btnKonfirmasiHapus");
    if (!btn) return;
    btn.addEventListener("click", () => {
        if (!hapusTarget.id) return;

        if (hapusTarget.type === "wahana") {
            const detail = DB.get("detail_transaksi");
            if (detail.some(d => d.wahana_id === hapusTarget.id)) {
                showToast("Wahana sudah dipakai di transaksi, tidak bisa dihapus!", "danger");
                bootstrap.Modal.getInstance($("modalHapus")).hide();
                return;
            }
            DB.set("wahana", DB.get("wahana").filter(w => w.id !== hapusTarget.id));
            showToast('<i class="bi bi-trash-fill me-1"></i> Wahana dihapus!');
            renderWahana();
            updateStats();
        } else {
            DB.set("detail_transaksi", DB.get("detail_transaksi").filter(d => d.transaksi_id !== hapusTarget.id));
            DB.set("transaksi", DB.get("transaksi").filter(t => t.id !== hapusTarget.id));
            showToast('<i class="bi bi-trash-fill me-1"></i> Transaksi dihapus!');
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
    const grid = $("wahanaGrid");
    const emptyKasir = $("emptyWahanaKasir");
    const badge = $("badgeJumlahWahana");
    if (!grid) return;

    grid.innerHTML = "";
    if (badge) badge.textContent = `${list.length} tersedia`;

    if (list.length === 0) {
        if (emptyKasir) emptyKasir.classList.remove("d-none");
        return;
    }
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
function kurangiItem(id) {
    if (!cart[id]) return;
    cart[id].jumlah--;
    if (cart[id].jumlah <= 0) delete cart[id];
    renderCart();
}
function hapusItem(id) {
    delete cart[id];
    renderCart();
}
function hitungTotalCart() {
    let t = 0;
    Object.values(cart).forEach(it => t += it.harga * it.jumlah);
    return t;
}

function renderCart() {
    const keys = Object.keys(cart);
    const cartList = $("cartList");
    const badgeItem = $("badgeJumlahItem");
    const cartTotal = $("cartTotal");
    const cartKembalian = $("cartKembalian");
    if (!cartList) return;

    if (badgeItem) badgeItem.textContent = `${keys.length} item`;

    if (keys.length === 0) {
        cartList.innerHTML = `
            <div class="cart-empty">
                <div class="empty-icon-cart">🛒</div>
                <p>Keranjang masih kosong</p>
                <small>Klik wahana untuk menambahkan</small>
            </div>`;
        cartTotal.textContent = "Rp 0";
        cartKembalian.textContent = "Rp 0";
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

    cartList.querySelectorAll(".btn-kurang").forEach(b =>
        b.addEventListener("click", () => kurangiItem(Number(b.dataset.id))));
    cartList.querySelectorAll(".btn-tambah").forEach(b =>
        b.addEventListener("click", () => {
            const it = cart[b.dataset.id];
            tambahItem(it.id, it.nama, it.harga);
        }));
    cartList.querySelectorAll(".btn-hapus").forEach(b =>
        b.addEventListener("click", () => hapusItem(Number(b.dataset.id))));

    cartTotal.textContent = rupiah(hitungTotalCart());
    hitungKembalian();
}

function hitungKembalian() {
    const inputBayar = $("inputBayar");
    const cartKembalian = $("cartKembalian");
    if (!inputBayar || !cartKembalian) return;
    const bayar = parseFloat(inputBayar.value) || 0;
    const kembali = bayar - hitungTotalCart();
    cartKembalian.textContent = rupiah(kembali >= 0 ? kembali : 0);
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

    const btnSimpan = $("btnSimpanTransaksi");
    if (!btnSimpan) return;

    btnSimpan.addEventListener("click", () => {
        const keys = Object.keys(cart);
        if (keys.length === 0) {
            showToast("Keranjang masih kosong!", "warning");
            return;
        }

        const total = hitungTotalCart();
        const bayar = parseFloat($("inputBayar").value) || 0;
        if (bayar < total) {
            showToast("Uang bayar kurang dari total!", "danger");
            return;
        }

        const kembalian = bayar - total;
        const kode = generateKode();
        const trxId = DB.nextId("transaksi");

        const trxList = DB.get("transaksi");
        trxList.push({
            id: trxId,
            kode_transaksi: kode,
            user_id: currentUser.id,
            nama_kasir: currentUser.nama,
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

        tampilkanStruk({
            kode_transaksi: kode,
            nama_kasir: currentUser.nama,
            tanggal: new Date().toISOString(),
            total, bayar, kembalian,
            items: Object.values(cart)
        });

        cart = {};
        $("inputBayar").value = "";
        renderCart();
        showToast('<i class="bi bi-check-circle-fill me-1"></i> Transaksi disimpan!');
        updateStats();
    });
}

// ============================================================
// LAPORAN
// ============================================================
function muatLaporan() {
    const filterDari = $("filterDari");
    const filterSampai = $("filterSampai");
    const container = $("laporanList");
    const emptyLaporan = $("emptyLaporan");
    const lapJumlah = $("lapJumlah");
    const lapPendapatan = $("lapPendapatan");
    const lapJumlahBadge = $("lapJumlahBadge");
    if (!container) return;

    if (!filterDari.value) {
        const d = new Date();
        d.setDate(1);
        filterDari.value = d.toISOString().split("T")[0];
    }
    if (!filterSampai.value) {
        filterSampai.value = new Date().toISOString().split("T")[0];
    }

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

    rows.forEach((r, i) => {
        const card = document.createElement("div");
        card.className = "trx-card";
        card.style.animationDelay = `${Math.min(i * 0.04, 0.3)}s`;
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
                <div class="trx-badge">Berhasil</div>
            </div>
            <div class="trx-card-actions">
                <button class="trx-btn trx-btn-view" data-id="${r.id}">👁️ Lihat Struk</button>
                <button class="trx-btn trx-btn-delete" data-id="${r.id}" data-kode="${escapeHtml(r.kode_transaksi)}">🗑️ Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll(".trx-btn-view").forEach(btn => {
        btn.addEventListener("click", () => lihatStrukLama(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".trx-btn-delete").forEach(btn => {
        btn.addEventListener("click", () => konfirmasiHapus("transaksi", Number(btn.dataset.id), btn.dataset.kode));
    });
}

function lihatStrukLama(trxId) {
    const trx = DB.get("transaksi").find(t => t.id === trxId);
    if (!trx) return;
    const items = DB.get("detail_transaksi")
        .filter(d => d.transaksi_id === trxId)
        .map(d => ({ nama: d.nama_wahana, harga: d.harga, jumlah: d.jumlah }));
    tampilkanStruk({ ...trx, items });
}

function initLaporan() {
    const btnFilter = $("btnFilter");
    if (btnFilter) btnFilter.addEventListener("click", muatLaporan);
}

// ============================================================
// STATISTIK DASHBOARD
// ============================================================
function updateStats() {
    const statWahana = $("statWahana");
    const statTransaksi = $("statTransaksi");
    const statHariIni = $("statHariIni");
    const statPendapatan = $("statPendapatan");
    if (!statWahana) return;

    statWahana.textContent = DB.get("wahana").filter(w => w.status === "aktif").length;

    const trx = DB.get("transaksi");
    const todayStr = new Date().toDateString();
    let totalPendapatan = 0;
    let hariIni = 0;

    trx.forEach(t => {
        totalPendapatan += t.total || 0;
        if (new Date(t.tanggal).toDateString() === todayStr) hariIni++;
    });

    statTransaksi.textContent = trx.length;
    statHariIni.textContent = hariIni;
    statPendapatan.textContent = rupiah(totalPendapatan);
}

function muatSemuaData() {
    renderWahana();
    updateStats();
}

// ============================================================
// MOBILE DRAWER
// ============================================================
function initMobileDrawer() {
    const menuBtn = $("mobileMenuBtn");
    const drawer = $("mobileDrawer");
    const overlay = $("mobileDrawerOverlay");
    const closeBtn = $("mobileDrawerClose");
    if (!menuBtn || !drawer) return;

    const openDrawer = () => {
        drawer.classList.add("open");
        if (overlay) overlay.classList.add("open");
        document.body.style.overflow = "hidden";
    };
    const closeDrawer = () => {
        drawer.classList.remove("open");
        if (overlay) overlay.classList.remove("open");
        document.body.style.overflow = "";
    };

    menuBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (overlay) overlay.addEventListener("click", closeDrawer);

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

    const logoutMobile = $("mobileLogout");
    if (logoutMobile) {
        logoutMobile.addEventListener("click", () => {
            closeDrawer();
            $("btnLogout")?.click();
        });
    }
}

// ---------- LIVE CLOCK (Mobile) ----------
function initMobileClock() {
    const update = () => {
        const t = $("mobileLiveTime");
        const d = $("mobileLiveDate");
        if (!t || !d) return;
        const now = new Date();
        const p = (x) => String(x).padStart(2, "0");
        t.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        d.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
    };
    update();
    setInterval(update, 1000);
}

// ============================================================
// INIT SEMUA
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
    initMobileClock();

    // Dark mode dari localStorage
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
    }

    console.log("✅ Kasir Wahana siap!");
})