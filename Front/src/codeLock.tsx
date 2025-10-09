import React, { useState } from "react";

interface CodeLockProps {
  prompt: string;
  expected: string;          // code attendu (concat des chiffres)
  onSuccess: () => void;     // si code correct
}

export default function CodeLock({ prompt, expected, onSuccess }: CodeLockProps) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");

  const check = () => {
    if (input.trim() === expected) {
      setFeedback("✅ Code correct !");
      setTimeout(onSuccess, 600);
    } else {
      setFeedback("❌ Mauvais code. Vérifiez l'ordre et réessayez.");
    }
  };

  return (
    <div>
      <p style={{ marginTop: 0 }}>{prompt}</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && check()}
        placeholder={`Entrez ${expected.length} chiffres…`}
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #444", background:"#101010", color:"#eaeaea" }}
      />
      <button
        onClick={check}
        style={{ marginTop: 8, padding: "8px 12px", background:"#2f6d3a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}
      >
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}
