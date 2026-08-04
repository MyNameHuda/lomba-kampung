// Shared client-side constants — used across multiple components.
// Single source of truth for icon maps, section styling, status labels.

// =================== Kategori icon map ===================
// Maps the FontAwesome icon class name stored in DB to an emoji glyph.
// Used as a quick visual identifier next to kategori name.
export const KAT_ICON: Record<string, string> = {
  "fa-child": "👶",
  "fa-user": "🧑",
  "fa-user-tie": "👨‍💼",
  "fa-baby": "👶",
  "fa-user-graduate": "🎓",
  "fa-person-cane": "🧓",
  "fa-person": "🧑",
  "fa-people-group": "👨‍👩‍👧",
  "fa-user-astronaut": "🧑‍🚀",
  "fa-heart": "❤️",
  "fa-star": "⭐",
  "fa-trophy": "🏆",
  "fa-medal": "🏅",
  "fa-crown": "👑",
};
export const DEFAULT_KAT_ICON = "👤";

// =================== Section styling ===================
// Used in /lomba/[id] (public) and /admin/peserta/[lombaId] (admin).
// Section = balita | anakL | anakP | dewasa, derived from kategori.min
// plus jenisKelamin for the L/P split.
export const SECTION_ICON: Record<string, string> = {
  balita: "fa-baby",
  anakL: "fa-child",
  anakP: "fa-child-dress",
  dewasa: "fa-user-tie",
};

// Color tokens — Tailwind arbitrary classes. Used for section header bands.
export const SECTION_COLOR = {
  balita: { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  anakL:  { bg: "bg-[#EFF6FF]", text: "text-[#1E40AF]", border: "border-[#BFDBFE]" },
  anakP:  { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  dewasa: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[#FDE68A]" },
} as const;

// =================== Status labels (pendaftar) ===================
export const PENDAFTAR_STATUS = {
  pending: { label: "Menunggu", bg: "bg-[#FEF3C7]", text: "text-[#B45309]" },
  disetujui: { label: "Disetujui", bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FCE0E0]", text: "text-[#9D1010]" },
  hadir: { label: "Hadir", bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
} as const;

// =================== Lomba status labels ===================
export const LOMBA_STATUS = {
  draft: { label: "Draft", bg: "bg-[#F3F4F6]", text: "text-[#6B7280]" },
  aktif: { label: "Aktif", bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  selesai: { label: "Selesai", bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
} as const;

// =================== Sumber (source) labels ===================
export const SUMBER = {
  publik: { label: "Publik", icon: "fas fa-globe" },
  manual: { label: "Manual", icon: "fas fa-user-plus" },
} as const;

// =================== App config ===================
export const APP_CONFIG = {
  // Maximum PJs per (lomba, kategori) — soft cap in form validation
  MAX_PJ_PER_KAT: 5,
  // Maximum syarat items per lomba
  MAX_SYARAT: 20,
  // Default app branding
  DEFAULT_APP_NAME: "Lomba Kampung",
  DEFAULT_KAMPUNG_NAME: "Kampung Merdeka",
  DEFAULT_TAHUN: "HUT RI ke-81 (2026)",
} as const;
