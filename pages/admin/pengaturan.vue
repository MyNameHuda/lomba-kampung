<script setup lang="ts">
// Admin Pengaturan — Vue 3 port of app/admin/pengaturan/* (5 tabs in one page).
// Tabs: Data & Backup, Kategori, Password, Profil, Tentang.
import AdminShell from "~/components/AdminShell.vue";
import { useNotify } from "~/composables/useNotify";
import KatTag from "~/components/KatTag.vue";

useHead({ title: "Pengaturan — Admin" });

const { data, refresh } = await useFetch<any>("/api/admin/pengaturan-data", { credentials: "include" });

const cfg = computed(() => data.value?.cfg);
const kats = ref<any[]>(data.value?.kats ?? []);
const activeTab = ref<"data" | "kategori" | "password" | "profil" | "tentang">("data");

// =================== Tab: Profil ===================
const profilForm = ref({ appName: "", kampungName: "", tahunAktif: "" });
const savingProfil = ref(false);
async function saveProfil() {
  savingProfil.value = true;
  try {
    await $fetch("/api/admin/settings", { method: "PATCH", body: profilForm.value, credentials: "include" });
    notify.success("Pengaturan disimpan");
    await refresh();
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal simpan");
  } finally {
    savingProfil.value = false;
  }
}

// =================== Tab: Password ===================
const pwdForm = ref({ currentPassword: "", newPassword: "", confirm: "" });
const savingPwd = ref(false);
async function changePassword() {
  if (pwdForm.value.newPassword !== pwdForm.value.confirm) {
    notify.error("Password baru tidak sama");
    return;
  }
  savingPwd.value = true;
  try {
    await $fetch("/api/admin/password", { method: "PATCH", body: { currentPassword: pwdForm.value.currentPassword, newPassword: pwdForm.value.newPassword }, credentials: "include" });
    notify.success("Password berhasil diubah");
    pwdForm.value = { currentPassword: "", newPassword: "", confirm: "" };
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal ubah password");
  } finally {
    savingPwd.value = false;
  }
}

// =================== Tab: Kategori ===================
const editingKat = ref<any | null>(null);
const creatingKat = ref(false);
function openCreateKat() { editingKat.value = null; creatingKat.value = true; }
function openEditKat(k: any) { editingKat.value = k; creatingKat.value = false; }
function closeKat() { creatingKat.value = false; editingKat.value = null; }
async function saveKat(formData: any) {
  try {
    const res: any = await $fetch("/api/admin/kategori", { method: "POST", body: formData, credentials: "include" });
    // For new kategori, server returns the auto-generated id. Show it in the toast
    // so admin knows what was created. For edit, the id is unchanged.
    const wasNew = !formData?.id;
    notify.success(wasNew ? `Kategori dibuat (ID: ${res?.id ?? "?"})` : "Kategori disimpan");
    closeKat();
    await refresh();
    kats.value = data.value?.kats ?? [];
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal simpan");
  }
}
async function deleteKat(k: any) {
  const ok = await notify.confirm({ title: "Hapus Kategori", message: `Hapus "${k.nama}"? Peserta & PJ yang terkait akan kehilangan referensi.`, variant: "danger", confirmText: "Hapus" });
  if (!ok) return;
  try {
    await $fetch(`/api/admin/kategori/${k.id}`, { method: "DELETE", credentials: "include" });
    notify.success("Kategori dihapus");
    await refresh();
    kats.value = data.value?.kats ?? [];
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal hapus");
  }
}

// =================== Tab: Data ===================
const resetting = ref(false);
async function doReset() {
  const ok = await notify.confirm({ title: "Reset Semua Data", message: "PERINGATAN! Semua lomba + pendaftar akan dihapus (kategori dipertahankan). Tindakan ini tidak bisa dibatalkan.", confirmText: "Reset", variant: "danger" });
  if (!ok) return;
  resetting.value = true;
  try {
    await $fetch("/api/admin/reset", { method: "POST", body: { confirm: true, keepKategori: true }, credentials: "include" });
    notify.success("Data direset. Kategori tetap ada.");
  } finally {
    resetting.value = false;
  }
}

const notify = useNotify();

// Initialize profil form when data loads
function syncProfil() {
  if (cfg.value) {
    profilForm.value = {
      appName: cfg.value.appName || "",
      kampungName: cfg.value.kampungName || "",
      tahunAktif: cfg.value.tahunAktif || "",
    };
  }
}
syncProfil();
</script>

<template>
  <AdminShell title="Pengaturan" breadcrumb="Pengaturan" active-nav="/admin/pengaturan">
    <!-- Tabs -->
    <div class="flex gap-1.5 mb-4 -mx-4 px-4 overflow-x-auto pb-1">
      <button
        v-for="t in [
          { k: 'data', l: 'Data & Backup', i: 'fa-database' },
          { k: 'kategori', l: 'Kategori', i: 'fa-tags' },
          { k: 'password', l: 'Password', i: 'fa-key' },
          { k: 'profil', l: 'Profil', i: 'fa-circle-user' },
          { k: 'tentang', l: 'Tentang', i: 'fa-info-circle' },
        ]"
        :key="t.k"
        type="button"
        class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-colors"
        :class="activeTab === t.k ? 'bg-primary border-primary text-white' : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary'"
        @click="activeTab = t.k as any"
      >
        <i :class="['fas', t.i]" /> {{ t.l }}
      </button>
    </div>

    <!-- ==================== Tab: Data & Backup ==================== -->
    <div v-if="activeTab === 'data'" class="space-y-4">
      <div class="card p-5">
        <h3 class="text-sm font-bold mb-2 flex items-center gap-2"><i class="fas fa-download text-primary" /> Backup Data</h3>
        <p class="text-[12px] text-[#6B7280] mb-3">Download seluruh data (settings + kategori + lomba + pendaftar) sebagai JSON. Restore dengan reset di bawah.</p>
        <a href="/api/admin/backup" class="btn btn-secondary" style="width: auto" download>
          <i class="fas fa-download" /> Download Backup JSON
        </a>
      </div>

      <div class="card p-5 border-l-4 border-l-[#DC2626]">
        <h3 class="text-sm font-bold mb-2 flex items-center gap-2 text-[#991B1B]">
          <i class="fas fa-triangle-exclamation" /> Reset Data (Danger Zone)
        </h3>
        <p class="text-[12px] text-[#6B7280] mb-3">
          <strong class="text-[#991B1B]">PERINGATAN:</strong> Semua lomba + pendaftar akan dihapus. Kategori tetap dipertahankan. Tindakan ini tidak bisa di-undo.
        </p>
        <button class="btn btn-sm" style="background: #DC2626; color: white; width: auto" :disabled="resetting" @click="doReset">
          <i v-if="resetting" class="fas fa-spinner fa-spin" />
          <i v-else class="fas fa-trash" />
          Reset Semua Data
        </button>
      </div>
    </div>

    <!-- ==================== Tab: Kategori ==================== -->
    <div v-if="activeTab === 'kategori'">
      <div class="flex items-center gap-2 mb-3">
        <p class="text-[12px] text-[#6B7280] flex-1">{{ kats.length }} kategori</p>
        <button class="btn btn-primary btn-sm" style="width: auto" @click="openCreateKat">
          <i class="fas fa-plus" /> Tambah Kategori
        </button>
      </div>
      <div class="space-y-2">
        <div v-for="k in kats" :key="k.id" class="card p-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" :style="{ background: k.colorBg, color: k.colorText }">
            <i :class="['fas', k.icon]" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-[14px] text-[#1F2937]">{{ k.nama }}</div>
            <div class="text-[11px] text-[#6B7280]">{{ k.min }}–{{ k.max === 999 ? k.min + "+" : k.max }} tahun · urutan {{ k.urutan }}</div>
          </div>
          <div class="row-actions">
            <button class="icon-action" @click="openEditKat(k)"><i class="fas fa-pen" /></button>
            <button class="icon-action danger" @click="deleteKat(k)"><i class="fas fa-trash" /></button>
          </div>
        </div>
      </div>
      <KategoriModal v-if="creatingKat || editingKat" :editing="editingKat" @close="closeKat" @save="saveKat" />
    </div>

    <!-- ==================== Tab: Password ==================== -->
    <div v-if="activeTab === 'password'" class="card p-5 max-w-[500px]">
      <h3 class="text-sm font-bold mb-1 flex items-center gap-2"><i class="fas fa-key text-primary" /> Ubah Password</h3>
      <p class="text-[12px] text-[#6B7280] mb-4">Password baru minimal 6 karakter.</p>
      <form class="space-y-3" @submit.prevent="changePassword">
        <div>
          <label class="label">Password Lama</label>
          <input v-model="pwdForm.currentPassword" type="password" class="input" autocomplete="current-password" />
        </div>
        <div>
          <label class="label">Password Baru</label>
          <input v-model="pwdForm.newPassword" type="password" class="input" autocomplete="new-password" />
        </div>
        <div>
          <label class="label">Konfirmasi Password Baru</label>
          <input v-model="pwdForm.confirm" type="password" class="input" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width: auto" :disabled="savingPwd">
          <i v-if="savingPwd" class="fas fa-spinner fa-spin" />
          <i v-else class="fas fa-key" />
          Ubah Password
        </button>
      </form>
    </div>

    <!-- ==================== Tab: Profil ==================== -->
    <div v-if="activeTab === 'profil'" class="card p-5 max-w-[500px]">
      <h3 class="text-sm font-bold mb-1 flex items-center gap-2"><i class="fas fa-circle-user text-primary" /> Profil Aplikasi</h3>
      <p class="text-[12px] text-[#6B7280] mb-4">Nama aplikasi + kampung + tahun aktif yang tampil di header publik.</p>
      <form class="space-y-3" @submit.prevent="saveProfil">
        <div>
          <label class="label">Nama Aplikasi</label>
          <input v-model="profilForm.appName" class="input" />
        </div>
        <div>
          <label class="label">Nama Kampung</label>
          <input v-model="profilForm.kampungName" class="input" />
        </div>
        <div>
          <label class="label">Tahun Aktif</label>
          <input v-model="profilForm.tahunAktif" class="input" />
        </div>
        <button type="submit" class="btn btn-primary" style="width: auto" :disabled="savingProfil">
          <i v-if="savingProfil" class="fas fa-spinner fa-spin" />
          <i v-else class="fas fa-save" />
          Simpan
        </button>
      </form>
    </div>

    <!-- ==================== Tab: Tentang ==================== -->
    <div v-if="activeTab === 'tentang'" class="card p-5">
      <h3 class="text-sm font-bold mb-3 flex items-center gap-2"><i class="fas fa-info-circle text-primary" /> Tentang Aplikasi</h3>
      <div class="space-y-3 text-[13px] text-[#1F2937] leading-relaxed">
        <p>
          <strong>Lomba Kampung</strong> adalah aplikasi gratis untuk mengelola perlombaan 17 Agustus di skala kampung.
          Fitur lengkap: manajemen lomba, pendaftaran publik, approval queue, Juara picker dengan stage system
          (Kualifikasi → Semi Final → Final), backup & export Excel.
        </p>
        <div class="bg-[#F9FAFB] rounded-lg p-4 text-[12px]">
          <div class="font-bold mb-1">Stack:</div>
          <ul class="list-disc pl-5 space-y-0.5">
            <li>Nuxt 3 + Vue 3 + TypeScript</li>
            <li>Tailwind 3.4 + custom CSS (paralel dgn Next.js versi original)</li>
            <li>Postgres 16 / Neon (free tier 0.5 GB + 191.9 compute-hr)</li>
            <li>Auth via sealed cookies (h3 useSession)</li>
            <li>ExcelJS untuk multi-sheet export</li>
          </ul>
        </div>
        <div class="text-[11px] text-[#9CA3AF] text-center pt-2">
          MIT License — Bebas dipakai untuk lomba kampung manapun. Merdeka!
        </div>
      </div>
    </div>
  </AdminShell>
</template>

