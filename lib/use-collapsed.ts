"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "malique_admin_sidebar_collapsed";

/** Desktop sidebar collapse-to-icon-rail state, persisted to localStorage. */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setCollapsed(saved === "1");
    } catch {
      /* ignore private-mode errors */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
