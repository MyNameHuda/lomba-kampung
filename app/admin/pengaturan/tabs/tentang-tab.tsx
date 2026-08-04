export default function TentangTab() {
  return (
    <div className="card mb-5">
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-circle-info text-primary"></i> Tentang Aplikasi</div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5">
            <div className="text-[11px] text-[#6B7280]">Versi</div>
            <div className="text-[13px] font-semibold">v1.1 MVP</div>
          </div>
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5">
            <div className="text-[11px] text-[#6B7280]">Lisensi</div>
            <div className="text-[13px] font-semibold">Free for Kampung Merdeka</div>
          </div>
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5">
            <div className="text-[11px] text-[#6B7280]">Stack</div>
            <div className="text-[13px] font-semibold">Next.js 14 + Turso</div>
          </div>
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5">
            <div className="text-[11px] text-[#6B7280]">Tujuan</div>
            <div className="text-[13px] font-semibold">Untuk HUT RI Kampung</div>
          </div>
        </div>
      </div>
    </div>
  );
}
