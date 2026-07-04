"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        color: "#000",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "1rem",
      }}>
        <div style={{
          maxWidth: "28rem",
          width: "100%",
          padding: "1.5rem",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#dc2626",
            fontWeight: 600,
            fontSize: "0.95rem",
            marginBottom: "1rem",
          }}>
            <AlertCircle size={20} />
            Critical error
          </div>
          <p style={{
            fontSize: "0.875rem",
            color: "#525252",
            marginBottom: "1rem",
          }}>
            A critical error occurred and the application cannot continue. The
            error has been logged.
          </p>
          {error?.message && (
            <pre style={{
              padding: "0.75rem",
              background: "#f3f4f6",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              overflow: "auto",
              marginBottom: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
