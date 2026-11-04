"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const commands = [
  { label: "Home", href: "/" },
  { label: "Find jobs", href: "/matches" },
  { label: "My applications", href: "/applications" },
  { label: "Analytics", href: "/analytics" },
  { label: "Employer workspace", href: "/employer" },
  { label: "Hiring pipeline", href: "/employer/pipeline" },
  { label: "My profile", href: "/profile" },
  { label: "Log in", href: "/login" },
  { label: "Sign up", href: "/signup" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 2000,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: "var(--wb-color-bg)",
          border: "1px solid var(--wb-color-border)",
          borderRadius: "var(--wb-radius-lg)",
          width: "min(520px, 90vw)",
          boxShadow: "var(--wb-shadow-md)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command…"
          style={{
            width: "100%",
            padding: "0.875rem 1rem",
            border: "none",
            borderBottom: "1px solid var(--wb-color-border)",
            background: "transparent",
            color: "var(--wb-color-text)",
            font: "inherit",
            outline: "none",
          }}
        />
        <ul style={{ listStyle: "none", margin: 0, padding: "0.5rem", maxHeight: "320px", overflow: "auto" }}>
          {filtered.map((c) => (
            <li key={c.href}>
              <button
                type="button"
                onClick={() => { router.push(c.href); setOpen(false); setQuery(""); }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.625rem 0.75rem",
                  border: "none",
                  background: "transparent",
                  color: "var(--wb-color-text)",
                  borderRadius: "var(--wb-radius-sm)",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li style={{ padding: "0.625rem 0.75rem", color: "var(--wb-color-muted)" }}>No results</li>
          )}
        </ul>
      </div>
    </div>
  );
}
