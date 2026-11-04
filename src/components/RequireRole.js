"use client";

import { useEffect } from "react";
import { useRole } from "../lib/useRole";

export default function RequireRole({ allow = [], children, fallback = "/login" }) {
  const { role, loading } = useRole();

  useEffect(() => {
    if (loading) return;
    if (!role || !allow.includes(role)) {
      window.location.assign(fallback);
    }
  }, [role, loading, allow, fallback]);

  if (loading) return null;
  if (!role || !allow.includes(role)) return null;
  return children;
}
