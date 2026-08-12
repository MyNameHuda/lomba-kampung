// Shared client+server constants — Vue 3 port of lib/constants.ts from Next.

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

export const SECTION_ICON: Record<string, string> = {
  balita: "fa-baby",
  anakL: "fa-child",
  anakP: "fa-child-dress",
  dewasa: "fa-user-tie",
};

export const SECTION_COLOR = {
  balita: { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  anakL: { bg: "bg-[#EFF6FF]", text: "text-[#1E40AF]", border: "border-[#BFDBFE]" },
  anakP: { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  dewasa: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[#FDE68A]" },
} as const;

export const SUMBER = {
  publik: { label: "Publik", icon: "fas fa-globe" },
  manual: { label: "Manual", icon: "fas fa-user-plus" },
} as const;

export const APP_CONFIG = {
  MAX_PJ_PER_KAT: 5,
  DEFAULT_APP_NAME: "Lomba Kampung",
  DEFAULT_KAMPUNG_NAME: "Kampung Kadu Jaya",
  DEFAULT_TAHUN: "HUT RI ke-81 (2026)",
} as const;
