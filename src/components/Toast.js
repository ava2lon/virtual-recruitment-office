"use client";

import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        background: type === "error" ? "var(--wb-color-danger)" : "var(--wb-color-primary)",
        color: "#fff",
        padding: "0.75rem 1rem",
        borderRadius: "var(--wb-radius-md)",
        boxShadow: "var(--wb-shadow-md)",
        zIndex: 1000,
        maxWidth: "320px",
      }}
    >
      {message}
    </div>
  );
}
