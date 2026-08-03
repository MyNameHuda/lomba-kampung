import { getLombaById, getKategori } from "@/lib/db";
import { notFound } from "next/navigation";
import DaftarForm from "./daftar-form";

export const dynamic = "force-dynamic";

export default async function DaftarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) notFound();

  const l = await getLombaById(idNum);
  if (!l || l.status !== "aktif") notFound();

  // Only pass kategori that this lomba is eligible for.
  // Backend API also validates, but showing irrelevant options is bad UX.
  const allKats = await getKategori();
  const eligibleSet = new Set(l.kategoriEligible);
  const kats = allKats.filter((k) => eligibleSet.has(k.id));

  return <DaftarForm lomba={l} kategori={kats} />;
}
