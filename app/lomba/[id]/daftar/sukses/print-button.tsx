"use client";

// Tiny client component so the success page (server component) can have a button
// with onClick handler. Without this, Next.js rejects onClick on a server component.
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-primary flex-1">
      <i className="fas fa-download"></i> Simpan Kartu
    </button>
  );
}
