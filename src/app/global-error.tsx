"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf6ff", color: "#403f86", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", padding: 32, borderRadius: 20, maxWidth: 420, textAlign: "center", boxShadow: "0 10px 30px rgba(124,58,237,.2)" }}>
          <h1 style={{ color: "#34337c", fontSize: 22 }}>Something went wrong</h1>
          <p style={{ fontSize: 14 }}>Please try again. If the problem continues, contact Swan Digital Solutions.</p>
          <button onClick={() => reset()} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, color: "#fff", background: "linear-gradient(135deg,#e11d48,#7c3aed)", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
