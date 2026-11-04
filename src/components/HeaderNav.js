"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

export default function HeaderNav() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return (
    <nav className="main-nav" aria-label="Main navigation">
      <a href="/matches">Find jobs</a>
      <a href="/employer">For employers</a>
      {authed && (
        <>
          <a href="/applications">My applications</a>
          <a href="/messages">Messages</a>
          <a href="/analytics">Analytics</a>
          <a href="/employer/pipeline">Pipeline</a>
          <a href="/profile">My profile</a>
          <a href="/settings">Settings</a>
        </>
      )}
    </nav>
  );
}
