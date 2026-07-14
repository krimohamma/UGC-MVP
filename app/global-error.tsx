"use client";

// This only fires if the ROOT layout itself throws (app/[locale]/layout.tsx
// or above) — Next.js requires it to render its own <html>/<body> since it
// replaces the entire tree, including next-intl's own provider. Deliberately
// does NOT import next-intl: if the i18n setup is what's broken, depending
// on it here would defeat the point of a last-resort fallback. Plain
// hardcoded French + Arabic text instead — this is the one page in the app
// that's allowed to not go through messages/*.json, for that reason.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Une erreur est survenue</h1>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            Veuillez réessayer ou revenir plus tard.
          </p>
          <p dir="rtl" style={{ fontSize: "0.875rem", color: "#666" }}>
            حدث خطأ ما. يرجى المحاولة مرة أخرى لاحقاً.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: "9999px",
              backgroundColor: "#111",
              color: "#fff",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Réessayer / إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
