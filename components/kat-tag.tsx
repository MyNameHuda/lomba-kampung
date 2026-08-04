// Renders a kategori badge with DB-driven colors.
// Falls back to CSS class if color fields are missing (e.g. for legacy rows).
// CSS classes in globals.css (`.tag-balita` etc.) still apply as a backup.

type Props = {
  nama: string;
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
  size?: "sm" | "md";
  className?: string;
};

export default function KatTag({ nama, colorBg, colorText, colorBorder, size = "md", className = "" }: Props) {
  // If colors are missing, fall back to default .tag class (CSS will style it).
  const useDbColors = colorBg && colorText && colorBorder;
  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1";

  if (!useDbColors) {
    return (
      <span className={`inline-flex items-center rounded-full font-bold border ${sizeClass} ${className}`}>
        {nama}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${sizeClass} ${className}`}
      style={{ background: colorBg, color: colorText, border: `1.5px solid ${colorBorder}` }}
    >
      {nama}
    </span>
  );
}
