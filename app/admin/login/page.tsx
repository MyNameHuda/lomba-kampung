"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login gagal");
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-3xl shadow">
            <i className="fas fa-flag"></i>
          </div>
          <h1 className="text-[22px] font-extrabold mb-1">Lomba Kampung</h1>
          <p className="text-[13px] text-[#6B7280]">Panel Admin Panitia 17 Agustus</p>
        </div>

        <form onSubmit={submit}>
          <div className="mb-4">
            <label className="label">Kata Sandi Admin</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
              className="input"
            />
            <div className="text-[11px] text-[#6B7280] mt-1.5 flex items-center gap-1">
              <i className="fas fa-circle-info"></i> Masukkan kata sandi yang diberikan ketua panitia
            </div>
          </div>

          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3 mb-3">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary btn-block disabled:opacity-60">
            {submitting ? <><i className="fas fa-spinner fa-spin"></i> Memproses...</> : <><i className="fas fa-right-to-bracket"></i> Masuk</>}
          </button>

          <div className="text-center mt-5 text-xs text-[#6B7280]">
            🇮🇩 Dirancang untuk panitia 17 Agustus
            <br />
            <span className="text-[10px] text-[#9CA3AF]">v1.0 MVP</span>
          </div>
        </form>
      </div>
    </div>
  );
}
