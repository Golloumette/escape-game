import React, { useState } from "react";

interface RiddleProps {
  question: string;
  answer: string;  // attendu en string
  hint?: string;
  onSolved: () => void;
}

export default function Riddle({ question, answer, hint, onSolved }: RiddleProps) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const check = () => {
    if (norm(input) === norm(String(answer))) {
      setFeedback("✅ Bonne réponse !");
      setTimeout(onSolved, 500);
    } else {
      setFeedback("❌ Mauvaise réponse, réessayez.");
    }
  };

  return (
    <div>
      <p style={{ marginTop: 0 }}>{question}</p>
      {hint && <p style={{ opacity: .7, fontStyle: "italic" }}>Indice : {hint}</p>}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && check()}
        placeholder="Votre réponse…"
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #444", background:"#101010", color:"#eaeaea" }}
      />
      <button
        onClick={check}
        style={{ marginTop: 8, padding: "8px 12px", background:"#188162", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}
      >
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}
