import React, { useState } from "react";
import type { PuzzleDef } from "./map";

interface PuzzleProps {
  riddle: PuzzleDef;
  onSolved: () => void;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export default function Puzzle({ riddle, onSolved }: PuzzleProps) {
  switch (riddle.type) {
    case "text":
      return <TextPuzzle question={riddle.question} answer={riddle.answer} hint={riddle.hint} onSolved={onSolved} />;
    case "mcq":
      return <McqPuzzle question={riddle.question} choices={riddle.choices} correctIndex={riddle.correctIndex} hint={riddle.hint} onSolved={onSolved} />;
    case "tf":
      return <TFPuzzle statement={riddle.statement} correct={riddle.correct} hint={riddle.hint} onSolved={onSolved} />;
    case "image-text":
      return <ImageTextPuzzle question={riddle.question} imageUrl={riddle.imageUrl} answer={riddle.answer} hint={riddle.hint} onSolved={onSolved} />;
    default:
      return <p>Type d’énigme inconnu.</p>;
  }
}

/* ---------- Text ---------- */
function TextPuzzle({ question, answer, hint, onSolved }: { question: string; answer: string; hint?: string; onSolved: () => void; }) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const check = () => {
    if (norm(input) === norm(String(answer))) {
      setFeedback("✅ Bonne réponse !");
      setTimeout(onSolved, 400);
    } else setFeedback("❌ Mauvaise réponse.");
  };
  return (
    <div>
      <p style={{ marginTop: 0 }}>{question}</p>
      {hint && <p style={{ opacity: .7, fontStyle: "italic" }}>Indice : {hint}</p>}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
        placeholder="Votre réponse…" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #444", background:"#101010", color:"#eaeaea" }}/>
      <button onClick={check} style={{ marginTop: 8, padding: "8px 12px", background:"#188162", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}

/* ---------- MCQ ---------- */
function McqPuzzle({ question, choices, correctIndex, hint, onSolved }:
  { question: string; choices: string[]; correctIndex: number; hint?: string; onSolved: () => void; }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const check = () => {
    if (picked === correctIndex) {
      setFeedback("✅ Bonne réponse !");
      setTimeout(onSolved, 400);
    } else setFeedback("❌ Mauvaise réponse.");
  };
  return (
    <div>
      <p style={{ marginTop: 0 }}>{question}</p>
      {hint && <p style={{ opacity: .7, fontStyle: "italic" }}>Indice : {hint}</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 0" }}>
        {choices.map((c, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="radio" name="mcq" checked={picked === i} onChange={() => setPicked(i)} />
              <span>{c}</span>
            </label>
          </li>
        ))}
      </ul>
      <button onClick={check} style={{ padding: "8px 12px", background:"#188162", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}

/* ---------- True/False ---------- */
function TFPuzzle({ statement, correct, hint, onSolved }:
  { statement: string; correct: boolean; hint?: string; onSolved: () => void; }) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const check = () => {
    if (picked === correct) {
      setFeedback("✅ Bonne réponse !");
      setTimeout(onSolved, 400);
    } else setFeedback("❌ Mauvaise réponse.");
  };
  return (
    <div>
      <p style={{ marginTop: 0 }}>{statement}</p>
      {hint && <p style={{ opacity: .7, fontStyle: "italic" }}>Indice : {hint}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={() => setPicked(true)} style={{ padding:"6px 10px" }}>Vrai</button>
        <button onClick={() => setPicked(false)} style={{ padding:"6px 10px" }}>Faux</button>
      </div>
      <button onClick={check} style={{ padding: "8px 12px", background:"#188162", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}

/* ---------- Image + texte ---------- */
function ImageTextPuzzle({ question, imageUrl, answer, hint, onSolved }:
  { question: string; imageUrl: string; answer: string; hint?: string; onSolved: () => void; }) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const check = () => {
    if (norm(input) === norm(String(answer))) {
      setFeedback("✅ Bonne réponse !");
      setTimeout(onSolved, 400);
    } else setFeedback("❌ Mauvaise réponse.");
  };

  return (
    <div>
      <p style={{ marginTop: 0 }}>{question}</p>

      <div style={{ display: "grid", placeItems: "center", margin: "8px 0", minHeight: 140, background: "#0e0e0e", border: "1px solid #333", borderRadius: 8, overflow: "hidden" }}>
        {loading && !err && <div style={{ padding: 12, opacity: .8 }}>Chargement de l’image…</div>}
        {!err ? (
          <img
            src={imageUrl}
            alt="indice visuel"
            style={{ maxWidth: "100%", maxHeight: 240, display: loading ? "none" : "block" }}
            onLoad={() => setLoading(false)}
            onError={() => { setErr("Impossible de charger l’image"); setLoading(false); }}
          />
        ) : (
          <div style={{ padding: 12, textAlign: "center", opacity: .85 }}>
            {err} — Vous pouvez quand même répondre.
          </div>
        )}
      </div>

      {hint && <p style={{ opacity: .7, fontStyle: "italic" }}>Indice : {hint}</p>}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
        placeholder="Votre réponse…" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #444", background:"#101010", color:"#eaeaea" }}/>
      <button onClick={check} style={{ marginTop: 8, padding: "8px 12px", background:"#188162", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
        Valider
      </button>
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </div>
  );
}
