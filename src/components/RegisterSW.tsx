"use client";
import { useEffect } from "react";

/** Regista o "service worker" que torna a app instalável e abre mais rápido. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
