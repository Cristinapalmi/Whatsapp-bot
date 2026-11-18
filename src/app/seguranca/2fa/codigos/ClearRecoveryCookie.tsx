"use client";
import { useEffect } from "react";
import { clearRecoveryCookieAction } from "../../actions";

/** Apaga o cookie com os códigos assim que a página os mostra. */
export function ClearRecoveryCookie() {
  useEffect(() => {
    clearRecoveryCookieAction().catch(() => {});
  }, []);
  return null;
}
