"use client";

import { useEffect, useState } from "react";
import { useWs } from "@/context/WebSocketContext";

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  /** First name if set, otherwise the local part of the email (before @) */
  displayName: string;
}

function parseProfile(raw: {
  first_name?: string;
  last_name?: string;
  email?: string;
  fullname?: string;
}): UserProfile {
  let firstName = raw.first_name ?? "";
  let lastName = raw.last_name ?? "";

  // authorize response uses "fullname" instead of separate fields
  if (!firstName && raw.fullname) {
    const parts = raw.fullname.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  const email = raw.email ?? "";
  const emailUser = email.split("@")[0] ?? "";
  const displayName = firstName || emailUser || email;

  return { firstName, lastName, email, displayName };
}

export function useUserProfile(): UserProfile | null {
  const { authWs, authStatus } = useWs();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (authStatus !== "connected" || !authWs) return;

    let active = true;

    // 1) Capture the auto-authorize response that Deriv sends on OTP connection.
    //    This fires immediately on connect and contains email + fullname.
    const unsubAuth = authWs.subscribe("authorize", (data) => {
      if (!active) return;
      const a = data.authorize as
        | { email?: string; fullname?: string }
        | undefined;
      if (!a?.email) return;
      setProfile(parseProfile(a));
      unsubAuth();
    });

    // 2) Also send get_settings as a fallback — it has first_name / last_name split.
    const unsubSettings = authWs.subscribe("get_settings", (data) => {
      if (!active) return;
      const s = data.get_settings as
        | { first_name?: string; last_name?: string; email?: string }
        | undefined;
      if (!s?.email && !s?.first_name) return;
      setProfile((prev) => {
        // Only overwrite if we get a better (non-empty) first_name
        const next = parseProfile(s);
        if (!prev) return next;
        return next.firstName ? next : prev;
      });
      unsubSettings();
    });

    authWs.send({ get_settings: 1 });

    return () => {
      active = false;
      unsubAuth();
      unsubSettings();
    };
  }, [authWs, authStatus]);

  // Clear profile on disconnect / logout
  useEffect(() => {
    if (authStatus === "disconnected") setProfile(null);
  }, [authStatus]);

  return profile;
}
