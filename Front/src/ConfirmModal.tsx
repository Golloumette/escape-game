import React from "react";

interface ConfirmModalProps {
  title?: string;
  message?: string;
  onYes: () => void;
  onNo: () => void;
}

export default function ConfirmModal({
  title = "Confirmer",
  message = "Voulez-vous continuer ?",
  onYes,
  onNo
}: ConfirmModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "grid", placeItems: "center", zIndex: 9999
    }}>
      <div style={{
        width: 420, maxWidth: "90vw",
        background: "#141414", color: "#eaeaea",
        border: "1px solid #2a2a2a", borderRadius: 12, padding: 16
      }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p style={{ opacity: .9 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onNo} style={{ padding:"8px 12px", background:"#444", border:"1px solid #555", borderRadius:6, cursor:"pointer" }}>
            Non
          </button>
          <button onClick={onYes} style={{ padding:"8px 12px", background:"#2f6d3a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
            Oui
          </button>
        </div>
      </div>
    </div>
  );
}
