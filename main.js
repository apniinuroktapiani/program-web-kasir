// main.js — Modern UI Version (localStorage)

// ============================================================
// DATABASE HELPER (localStorage)
// ============================================================
const DB = {
    get(key) {
        return JSON.parse(localStorage.getItem(key) || "[]");
    },
    set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    },
    init() {
        if (!localStorage.getItem("users")) {
            this.set("users", [
                { id: 1, nama: "Admin Wahana", username: "admin", password: "admin123", role: "admin" },
                { id: 2, nama: "Rina", username: "rina", password: "rina123", role: "kasir" }
            ]);
        }
        if (!localStorage.getItem("wahana")) {
            this.set("wahana", [
                { id: 1, nama_wahana: "ATV", harga: 50000, status: "aktif", emoji: "🏍️" },
                { id: 2, nama_wahana: "Kelinci", harga: 10000, status: "aktif", emoji: "🐰" },
                { id: 3, nama_wahana: "Kuda", harga: 25000, status: "aktif", emoji: "🐴" },
                { id: 4, nama_wahana: "Paintball", harga: 75000, status: "aktif", emoji: "🎯" }
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

// Emoji otomatis berdasarkan nama
const EMOJI_MAP = {
    "atv": "🏍️", "kelinci": "🐰", "kuda": "🐴", "paintball": "🎯",
    "perahu": "⛵", "sepeda": "🚴", "panah": "🏹", "ayunan": "🎠",
    "kolam": "🏊", "mobil": "🚗", "motor": "🏍️", "kereta": "🚂"
};
function getEmoji(nama) {
    const n = (nama || "").toLowerCase();
    for (const k in EMOJI_MAP) {
        if (n.includes(k)) return EMOJI_MAP[k];
    }
    return "🎪";
}

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let cart = {};
let hapusTarget = { type: null, id: null };

// ============================================================
// DOM
// ============================================================
const $ = (id) => document.getElementById(id);

const loginPage = $("loginPage");
const appPage = $("appPage");
const formLogin = $("formLogin");
const loginUsername = $("loginUsername");
const loginPassword = $("loginPassword");
const loginError = $("loginError");
const loginErrorMsg = $("loginErrorMsg");
const userNama = $("userNama");
const userRole = $("userRole");
const userAvatar = $("userAvatar");
const btnLogout = $("btnLogout");

const tbodyWahana = $("tbodyWahana");
const emptyWahana = $("emptyWahana");
const btnTambahWahana = $("btnTambahWahana");
const formWahana = $("formWahana");
const wahanaId = $("wahanaId");
const wahanaNama = $("wahanaNama");
const wahanaHarga = $("wahanaHarga");
const wahanaStatus = $("wahanaStatus");
const modalWahanaTitle = $("modalWahanaTitle");
const btnSimpanWahana = $("btnSimpanWahana");

const modalHapus = new bootstrap.Modal($("modalHapus"));
const hapusPesan = $("hapusPesan");
const btnKonfirmasiHapus = $("btnKonfirmasiHapus");

const wahanaGrid = $("wahanaGrid");
const emptyWahanaKasir = $("emptyWahanaKasir");
const cartList = $("cartList");
const cartTotal = $("cartTotal");
const cartKembalian = $("cartKembalian");
const inputBayar = $("inputBayar");
const btnSimpanTransaksi = $("btnSimpanTransaksi");
const badgeJumlahItem = $("badgeJumlahItem");
const badgeJumlahWahana = $("badgeJumlahWahana");

const filterDari = $("filterDari");
const filterSampai = $("filterSampai");
const btnFilter = $("btnFilter");
const tbodyLaporan = $("tbodyLaporan");
const emptyLaporan = $("emptyLaporan");
const lapJumlah = $("lapJumlah");
const lapPendapatan = $("lapPendapatan");

const modalStruk = new bootstrap.Modal($("modalStruk"));
const strukBody = $("strukBody");

const toastEl = $("liveToast");
const toastMessage = $("toastMessage");
const toast = new bootstrap.Toast(toastEl, { delay: 2500 });

// ============================================================
// UTIL
// ============================================================
function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}
function rupiah(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
}
function showToast(msg, type = "success") {
    const bg = { success: "bg-success", danger: "bg-danger", warning: "bg-warning text-dark", info: "bg-info text-dark" };
    toastEl.className = `toast align-items-center text-white border-0 ${bg[type] || "bg-primary"}`;
    toastMessage.innerHTML = msg;
    toast.show();
}
function generateKode() {
    const n = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `TRX-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${Math.floor(100 + Math.random() * 900)}`;
}
function formatTanggal(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
        " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function getInitials(nama) {
    return (nama || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ============================================================
// LOGIN
// ============================================================
formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.classList.add("d-none");

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

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
    showToast(`<i class="bi bi-check-circle-fill me-1"></i> Selamat datang, ${escapeHtml(user.nama)}!`, "success");
});

function loginSuccess() {
    loginPage.classList.add("d-none");
    appPage.classList.remove("d-none");
    userNama.textContent = currentUser.nama;
    userRole.textContent = currentUser.role;
    userAvatar.textContent = getInitials(currentUser.nama);

    // Sembunyikan menu Wahana untuk kasir
    document.querySelectorAll(".nav-wahana-link")
        .forEach(el => el.style.display = currentUser.role === "admin" ? "" : "none");

    navigateTo("dashboard");
    muatSemuaData();
}

const savedUser = sessionStorage.getItem("kasirUser");
if (savedUser) {
    try {
        currentUser = JSON.parse(savedUser);
        loginSuccess();
    } catch (e) { sessionStorage.removeItem("kasirUser"); }
}

// ============================================================
// LOGOUT
// ============================================================
btnLogout.addEventListener("click", () => {
    if (!confirm("Yakin ingin logout?")) return;
    sessionStorage.removeItem("kasirUser");
    currentUser = null;
    cart = {};
    appPage.classList.add("d-none");
    loginPage.classList.remove("d-none");
    formLogin.reset();
    loginError.classList.add("d-none");
    showToast("<i class='bi bi-box-arrow-right me-1'></i> Anda telah logout.", "info");
});

// ============================================================
// NAVIGASI
// ============================================================
function navigateTo(page) {
    document.querySelectorAll(".app-page").forEach(el => el.classList.add("d-none"));
    $("page-" + page).classList.remove("d-none");
    document.querySelectorAll(".navbar-nav .nav-link").forEach(a => {
        a.classList.toggle("active", a.dataset.page === page);
    });
    if (page === "laporan") muatLaporan();
    if (page === "kasir") renderKasirGrid();
    if (page === "wahana") renderWahana();
}

document.querySelectorAll(".navbar-nav .nav-link").forEach(a => {
    a.addEventListener("click", (e) => {
        e.preventDefault();
        if (a.dataset.page) {
            navigateTo(a.dataset.page);
            // Tutup menu mobile setelah klik
            const navMenu = $("navMenu");
            if (navMenu.classList.contains("show")) {
                bootstrap.Collapse.getInstance(navMenu)?.hide();
            }
        }
    });
});
document.querySelectorAll(".btn-goto").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
});

// ============================================================
// WAHANA - READ
// ============================================================
function renderWahana() {
    const list = DB.get("wahana");
    tbodyWahana.innerHTML = "";

    if (list.length === 0) {
        emptyWahana.classList.remove("d-none");
        return;
    }
    emptyWahana.classList.add("d-none");

    list.forEach((w, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${i + 1}</strong></td>
            <td>
                <div style="display:flex;align-items:center;gap:.6rem;">
                    <span style="font-size:1.5rem;">${w.emoji || getEmoji(w.nama_wahana)}</span>
                    <span style="font-weight:700;">${escapeHtml(w.nama_wahana)}</span>
                </div>
            </td>
            <td style="font-weight:700;color:var(--primary);">${rupiah(w.harga)}</td>
            <td><span class="badge-status ${w.status}">${w.status}</span></td>
            <td class="text-center">
                <button class="btn-action edit me-1 btn-edit-wahana" data-id="${w.id}" title="Edit">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn-action delete btn-hapus-wahana" data-id="${w.id}" data-nama="${escapeHtml(w.nama_wahana)}" title="Hapus">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        tbodyWahana.appendChild(tr);
    });

    document.querySelectorAll(".btn-edit-wahana").forEach(btn => {
        btn.addEventListener("click", () => bukaModalWahana(Number(btn.dataset.id)));
    });
    document.querySelectorAll(".btn-hapus-wahana").forEach(btn => {
        btn.addEventListener("click", () => {
            konfirmasiHapus("wahana", Number(btn.dataset.id), btn.dataset.nama);
        });
    });
}

// ============================================================
// WAHANA - CREATE / UPDATE
// ============================================================
function bukaModalWahana(id = null) {
    formWahana.reset();
    wahanaId.value = "";

    if (id) {
        modalWahanaTitle.innerHTML = '<i class="bi bi-pencil-fill"></i> Edit Wahana';
        btnSimpanWahana.innerHTML = '<i class="bi bi-check-lg"></i> Perbarui';
        const list = DB.get("wahana");
        const w = list.find(x => x.id === id);
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
    new bootstrap.Modal($("modalWahana")).show();
}

btnTambahWahana.addEventListener("click", () => bukaModalWahana(null));

formWahana.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = wahanaId.value ? Number(wahanaId.value) : null;
    const nama = wahanaNama.value.trim();
    const harga = parseFloat(wahanaHarga.value) || 0;

    if (!nama || harga <= 0) {
        showToast("Semua field wajib diisi dengan benar!", "warning");
        return;
    }

    const data = {
        nama_wahana: nama,
        harga: harga,
        status: wahanaStatus.value,
        emoji: getEmoji(nama)
    };

    const list = DB.get("wahana");
    if (id) {
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) list[idx] = { ...list[idx], ...data };
        showToast('<i class="bi bi-check-circle-fill me-1"></i> Wahana diperbarui!', "success");
    } else {
        const newId = DB.nextId("wahana");
        list.push({ id: newId, ...data });
        showToast('<i class="bi bi-check-circle-fill me-1"></i> Wahana ditambahkan!', "success");
    }
    DB.set("wahana", list);

    bootstrap.Modal.getInstance($("modalWahana")).hide();
    renderWahana();
    updateStats();
});

// ============================================================
// WAHANA - DELETE
// ============================================================
function konfirmasiHapus(type, id, nama) {
    hapusTarget = { type, id };
    if (type === "wahana") {
        hapusPesan.innerHTML = `Yakin ingin menghapus wahana <strong>${escapeHtml(nama)}</strong>?<br><small class="text-muted">Tindakan ini tidak dapat dibatalkan.</small>`;
    } else if (type === "transaksi") {
        hapusPesan.innerHTML = `Yakin ingin menghapus transaksi <strong>${escapeHtml(nama)}</strong>?<br><small class="text-muted">Tindakan ini tidak dapat dibatalkan.</small>`;
    }
    modalHapus.show();
}

btnKonfirmasiHapus.addEventListener("click", () => {
    if (!hapusTarget.id) return;

    if (hapusTarget.type === "wahana") {
        const detail = DB.get("detail_transaksi");
        const dipakai = detail.some(d => d.wahana_id === hapusTarget.id);
        if (dipakai) {
            showToast("Wahana sudah dipakai di transaksi, tidak bisa dihapus!", "danger");
            modalHapus.hide();
            return;
        }
        let list = DB.get("wahana");
        list = list.filter(w => w.id !== hapusTarget.id);
        DB.set("wahana", list);
        showToast('<i class="bi bi-trash-fill me-1"></i> Wahana dihapus!', "success");
        renderWahana();
        updateStats();
    } else if (hapusTarget.type === "transaksi") {
        let detail = DB.get("detail_transaksi").filter(d => d.transaksi_id !== hapusTarget.id);
        DB.set("detail_transaksi", detail);
        let trx = DB.get("transaksi").filter(t => t.id !== hapusTarget.id);
        DB.set("transaksi", trx);
        showToast('<i class="bi bi-trash-fill me-1"></i> Transaksi dihapus!', "success");
        muatLaporan();
        updateStats();
    }

    modalHapus.hide();
    hapusTarget = { type: null, id: null };
});

// ============================================================
// KASIR
// ============================================================
function renderKasirGrid() {
    const list = DB.get("wahana").filter(w => w.status === "aktif");
    wahanaGrid.innerHTML = "";
    badgeJumlahWahana.textContent = `${list.length} tersedia`;

    if (list.length === 0) {
        emptyWahanaKasir.classList.remove("d-none");
        return;
    }
    emptyWahanaKasir.classList.add("d-none");

    list.forEach(w => {
        const div = document.createElement("div");
        div.className = "wahana-item";
        div.dataset.id = w.id;
        div.dataset.nama = w.nama_wahana;
        div.dataset.harga = w.harga;
        div.innerHTML = `
            <span class="wahana-emoji">${w.emoji || getEmoji(w.nama_wahana)}</span>
            <div class="wahana-name">${escapeHtml(w.nama_wahana)}</div>
            <div class="wahana-price">${rupiah(w.harga)}</div>
        `;
        div.addEventListener("click", () => {
            tambahItem(w.id, w.nama_wahana, w.harga);
        });
        wahanaGrid.appendChild(div);
    });
}

function tambahItem(id, nama, harga) {
    if (cart[id]) cart[id].jumlah++;
    else cart[id] = { id, nama, harga, jumlah: 1 };
    renderCart();
    showToast(`<i class="bi bi-plus-circle-fill me-1"></i> ${escapeHtml(nama)} ditambahkan`, "success");
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
    Object.values(cart).forEach(it => { t += it.harga * it.jumlah; });
    return t;
}

function renderCart() {
    const keys = Object.keys(cart);
    badgeJumlahItem.textContent = `${keys.length} item`;

    if (keys.length === 0) {
        cartList.innerHTML = `
            <div class="cart-empty">
                <i class="bi bi-cart-x"></i>
                <p>Keranjang masih kosong<br><small>Klik wahana untuk menambahkan</small></p>
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

inputBayar.addEventListener("input", hitungKembalian);
function hitungKembalian() {
    const bayar = parseFloat(inputBayar.value) || 0;
    const kembali = bayar - hitungTotalCart();
    cartKembalian.textContent = rupiah(kembali >= 0 ? kembali : 0);
}

btnSimpanTransaksi.addEventListener("click", () => {
    const keys = Object.keys(cart);
    if (keys.length === 0) {
        showToast("Keranjang masih kosong!", "warning");
        return;
    }

    const total = hitungTotalCart();
    const bayar = parseFloat(inputBayar.value) || 0;
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
    inputBayar.value = "";
    renderCart();
    showToast('<i class="bi bi-check-circle-fill me-1"></i> Transaksi disimpan!', "success");
    updateStats();
});

// ============================================================
// STRUK
// ============================================================
function tampilkanStruk(trx) {
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
                <div style="font-size:2rem;">🎪</div>
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
    modalStruk.show();
}

// ============================================================
// LAPORAN
// ============================================================
function muatLaporan() {
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

    const list = DB.get("transaksi");
    const rows = list.filter(t => {
        const tgl = new Date(t.tanggal);
        return tgl >= dari && tgl <= sampai;
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    tbodyLaporan.innerHTML = "";
    if (rows.length === 0) {
        emptyLaporan.classList.remove("d-none");
        lapJumlah.textContent = "0";
        lapPendapatan.textContent = "Rp 0";
        return;
    }
    emptyLaporan.classList.add("d-none");

    let totalPendapatan = 0;
    rows.forEach((r, i) => {
        totalPendapatan += r.total || 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${i + 1}</strong></td>
            <td><span style="font-family:'JetBrains Mono',monospace;font-size:.82rem;background:rgba(99,102,241,.08);padding:.25rem .55rem;border-radius:6px;">${escapeHtml(r.kode_transaksi)}</span></td>
            <td>${formatTanggal(r.tanggal)}</td>
            <td>${escapeHtml(r.nama_kasir || "-")}</td>
            <td style="font-weight:700;color:var(--primary);">${rupiah(r.total)}</td>
            <td class="text-center">
                <button class="btn-action view me-1 btn-lihat-struk" data-id="${r.id}" title="Lihat Struk">
                    <i class="bi bi-receipt"></i>
                </button>
                <button class="btn-action delete btn-hapus-trx" data-id="${r.id}" data-kode="${escapeHtml(r.kode_transaksi)}" title="Hapus">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        tbodyLaporan.appendChild(tr);
    });

    lapJumlah.textContent = rows.length;
    lapPendapatan.textContent = rupiah(totalPendapatan);

    document.querySelectorAll(".btn-lihat-struk").forEach(btn => {
        btn.addEventListener("click", () => lihatStrukLama(Number(btn.dataset.id)));
    });
    document.querySelectorAll(".btn-hapus-trx").forEach(btn => {
        btn.addEventListener("click", () => {
            konfirmasiHapus("transaksi", Number(btn.dataset.id), btn.dataset.kode);
        });
    });
}

function lihatStrukLama(trxId) {
    const trx = DB.get("transaksi").find(t => t.id === trxId);
    if (!trx) return;
    const detail = DB.get("detail_transaksi").filter(d => d.transaksi_id === trxId);
    const items = detail.map(d => ({
        nama: d.nama_wahana,
        harga: d.harga,
        jumlah: d.jumlah
    }));
    tampilkanStruk({ ...trx, items });
}

btnFilter.addEventListener("click", muatLaporan);

// ============================================================
// STATISTIK
// ============================================================
function updateStats() {
    const wahana = DB.get("wahana");
    const aktif = wahana.filter(w => w.status === "aktif").length;
    $("statWahana").textContent = aktif;

    const trx = DB.get("transaksi");
    let totalPendapatan = 0;
    let hariIni = 0;
    const todayStr = new Date().toDateString();

    trx.forEach(t => {
        totalPendapatan += t.total || 0;
        if (new Date(t.tanggal).toDateString() === todayStr) hariIni++;
    });

    $("statTransaksi").textContent = trx.length;
    $("statHariIni").textContent = hariIni;
    $("statPendapatan").textContent = rupiah(totalPendapatan);
}

// ============================================================
// LOAD
// ============================================================
function muatSemuaData() {
    renderWahana();
    updateStats();
}

console.log("✅ Kasir Wahana Modern UI siap!");