"use client";
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm print:hidden">
      Imprimir / guardar PDF
    </button>
  );
}
