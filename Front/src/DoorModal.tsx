import React, { ReactNode, useEffect } from "react";

interface DoorModalProps {
  title?: string;
  onClose: () => void;
  children?: ReactNode;
}

export default function DoorModal({ title = "Porte ouverte", onClose, children }: DoorModalProps) {
  // fermer avec Echap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "grid", placeItems: "center", zIndex: 9999
    }}>
      <div style={{
        width: 420, maxWidth: "90vw",
        background: "#141414", color: "#eaeaea",
        border: "1px solid #2a2a2a", borderRadius: 12, padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "transparent", color: "#eaeaea", border: "1px solid #444",
            borderRadius: 6, padding: "4px 8px", cursor: "pointer"
          }}>Fermer</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
