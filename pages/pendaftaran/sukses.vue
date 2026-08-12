<script setup lang="ts">
// Public success page — Vue 3 port of app/lomba/[id]/daftar/sukses/page.tsx + print-button.tsx
// With festive UI/UX polish.
import { displayKategoriName } from "~/utils/format";

const route = useRoute();
const nomor = computed(() => (route.query.nomor as string) || "");
const hasNomor = computed(() => nomor.value.length > 0);

const { data } = await useFetch<{
  pendaftar: { id: number; nama: string; umur: number; jenisKelamin: "L" | "P" } | null;
  lomba: { id: number; nama: string; emoji: string } | null;
  kategori: { id: string; nama: string } | null;
  cfg: { appName: string; kampungName: string; tahunAktif: string } | null;
}>(() => (hasNomor.value ? `/api/public/pendaftar-sukses/${nomor.value}` : null), {
  credentials: "include",
});

useHead(() => ({
  title: hasNomor.value
    ? `Pendaftaran Berhasil — ${data.value?.cfg?.appName || "Lomba Kampung"}`
    : `Bukti Pendaftaran — ${data.value?.cfg?.appName || "Lomba Kampung"}`,
}));

function doPrint() {
  if (typeof window !== "undefined") window.print();
}

async function doShare() {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "Pendaftaran Lomba Berhasil!",
        text: `Saya baru saja mendaftar lomba ${data.value?.lomba?.nama || ""} di ${data.value?.cfg?.appName || "Lomba Kampung"}. Nomor: ${nomor.value}`,
        url: typeof window !== "undefined" ? window.location.origin : "",
      });
    } catch {
      // user cancelled or share failed
    }
  } else {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(
        `Saya baru saja mendaftar lomba ${data.value?.lomba?.nama || ""} di ${data.value?.cfg?.appName || "Lomba Kampung"}. Nomor: ${nomor.value}`
      );
      alert("Teks disalin ke clipboard");
    } catch {
      // ignore
    }
  }
}
</script>

<template>
  <div class="mobile-page">
    <header class="app-header">
      <div class="header-content header-content-wide">
        <NuxtLink to="/" class="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali ke daftar lomba">
          <i class="fas fa-arrow-left" />
        </NuxtLink>
        <div class="logo flex-1 text-center">
          <img src="/logo.webp" alt="Logo IPPeKa" class="w-6 h-6 rounded-full object-cover inline-block mr-1.5 bg-white/10" />
          <span class="text-base font-bold">{{ data?.cfg?.appName || "Lomba Kampung" }}</span>
        </div>
        <span class="w-9" />
      </div>
    </header>

    <main class="app-content max-w-[600px] mx-auto w-full">
      <template v-if="hasNomor">
        <!-- Festive celebration banner -->
        <div class="celebrate-banner">
          <div class="celebrate-trophy anim-float">🏆</div>
          <h1 class="celebrate-title">Pendaftaran Berhasil!</h1>
          <p class="celebrate-subtitle">Bukti pendaftaran Anda sudah tersimpan. Tunjukkan kartu ini di lokasi lomba.</p>
        </div>

        <!-- Participant card -->
        <div class="kartu-peserta w-full max-w-[420px] mx-auto mt-6 bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-primary anim-fade-up" style="animation-delay: 200ms">
          <div class="bg-gradient-to-br from-primary to-primary-dark text-white p-4 flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-bold">
              <img src="/logo.webp" alt="Logo IPPeKa" class="w-5 h-5 rounded-full object-cover" />
              <span>KARTU PESERTA</span>
            </div>
            <span class="bg-accent text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">HUT RI 81</span>
          </div>

          <div class="p-5">
            <div class="text-[10px] text-[#6B7280] tracking-wider">NOMOR PENDAFTARAN</div>
            <div class="font-mono text-lg font-bold text-primary mb-3.5">{{ nomor }}</div>

            <template v-if="data?.pendaftar">
              <div class="text-base font-bold text-[#1F2937] mb-3.5 border-b-2 border-dashed border-[#E5E7EB] pb-3.5 break-words">
                {{ data.pendaftar.nama }}
              </div>
              <div class="flex flex-col gap-2.5 text-xs leading-relaxed">
                <div class="flex justify-between gap-2">
                  <span class="text-[#6B7280]">Lomba</span>
                  <span class="font-semibold text-right break-words">
                    {{ data.lomba?.emoji }} {{ data.lomba?.nama }}
                  </span>
                </div>
                <div class="flex justify-between gap-2">
                  <span class="text-[#6B7280]">Kategori</span>
                  <span class="font-semibold">
                    {{ data.kategori ? displayKategoriName(data.kategori.id, { nama: data.kategori.nama }) : "" }} ({{ data.pendaftar.umur }} th)
                  </span>
                </div>
                <div class="flex justify-between gap-2">
                  <span class="text-[#6B7280]">Status</span>
                  <span class="font-semibold text-[#B45309]">⏳ Menunggu Verifikasi</span>
                </div>
              </div>
            </template>
            <div v-else class="text-sm text-[#6B7280] italic text-center py-3">
              Data pendaftar tidak ditemukan. Hubungi PJ lomba.
            </div>
          </div>

          <div class="bg-[#F9FAFB] p-3.5 text-center text-[10px] text-[#9CA3AF] italic border-t border-[#E5E7EB]">
            "Merdeka atau Mati!" — Panitia 17 Agustus Kampung Kadu Jaya
          </div>
        </div>

        <!-- Next steps notice -->
        <div class="notice notice-info mt-4 max-w-[420px] mx-auto anim-fade-up" style="animation-delay: 280ms">
          <i class="fas fa-circle-info" />
          <div>
            <strong>Langkah selanjutnya:</strong>
            <ol class="m-0 pl-4 text-[12px] leading-relaxed">
              <li>Tunggu admin verifikasi (cek WA PJ lomba)</li>
              <li>Hadir di lokasi sesuai jadwal</li>
              <li>Tunjukkan kartu peserta atau sebutkan nomor</li>
            </ol>
          </div>
        </div>

        <div class="flex gap-2.5 w-full max-w-[420px] mx-auto mt-5">
          <button class="btn btn-primary flex-1" @click="doPrint">
            <i class="fas fa-download" /> Simpan Kartu
          </button>
          <button class="btn btn-secondary" style="width: auto" @click="doShare" aria-label="Bagikan">
            <i class="fas fa-share-nodes" />
          </button>
        </div>
      </template>

      <template v-else>
        <!-- Empty state: no ?nomor= query (deep link w/o context, or bookmark) -->
        <div class="celebrate-banner">
          <div class="celebrate-trophy anim-float">🎟️</div>
          <h1 class="celebrate-title">Halaman Bukti Pendaftaran</h1>
          <p class="celebrate-subtitle">Halaman ini untuk menampilkan kartu peserta setelah Anda menyelesaikan pendaftaran.</p>
        </div>

        <div class="notice notice-info mt-6 max-w-[420px] mx-auto">
          <i class="fas fa-circle-info" />
          <div class="text-sm">
            <strong>Tidak ada nomor pendaftaran.</strong>
            <p class="mt-1.5 leading-relaxed">
              Buka halaman lomba dan pilih "Daftar" untuk mulai pendaftaran,
              atau cek WhatsApp/email untuk link bukti pendaftaran Anda.
            </p>
          </div>
        </div>
      </template>

      <div class="text-center mt-6">
        <NuxtLink to="/" class="btn btn-ghost inline-flex">
          <i class="fas fa-arrow-left" /> Kembali ke daftar lomba
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

