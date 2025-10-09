import React, { useEffect, useMemo, useRef, useState } from "react";

export interface TimerProps {
  /** Durée initiale en secondes */
  initialSeconds: number;
  /** Démarrer automatiquement ? (défaut: true) */
  autoStart?: boolean;
  /** Mettre en pause depuis l'extérieur (ex: quand une modale s'ouvre) */
  paused?: boolean;
  /** Callback appelé quand le temps atteint 0 */
  onExpire?: () => void;
}

export default function Timer({
  initialSeconds,
  autoStart = true,
  paused = false,
  onExpire,
}: TimerProps) {
  const [remaining, setRemaining] = useState<number>(initialSeconds);
  const [running, setRunning] = useState<boolean>(autoStart);
  const [manuallyPaused, setManuallyPaused] = useState<boolean>(false);
  const timerRef = useRef<number | undefined>(undefined);

  // état "effectif" de pause = pause externe (modale) OU pause manuelle
  const isPaused = paused || manuallyPaused;

  // démarrer / arrêter l'intervalle selon running/isPaused
  useEffect(() => {
    // nettoyer intervalle précédent
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }

    if (running && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            // expiration
            clearInterval(timerRef.current);
            timerRef.current = undefined;
            setRunning(false);
            onExpire?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, isPaused, onExpire]);

  // si la durée initiale change, on réinitialise
  useEffect(() => {
    setRemaining(initialSeconds);
    setRunning(autoStart);
    setManuallyPaused(false);
  }, [initialSeconds, autoStart]);

  // Actions
  const start = () => { setRunning(true); setManuallyPaused(false); };
  const pause = () => setManuallyPaused(true);
  const resume = () => setManuallyPaused(false);
  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(initialSeconds);
    setRunning(false);
    setManuallyPaused(false);
  };
  const addTime = (seconds: number) => setRemaining((prev) => Math.max(0, prev + seconds));

  // Affichage
  const formatted = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [remaining]);

  return (
    <div style={{
      width: 217, margin: "16px auto", textAlign: "center",
      background: "#101010", border: "1px solid #2a2a2a",
      borderRadius: 10, padding: 12, boxShadow: "0 6px 16px rgba(0,0,0,.25)"
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>⏳ Compte à rebours</div>

      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 44, marginBottom: 10 }}>
        {formatted}
      </div>

      

      {/* état technique en petit */}
      <div style={{ marginTop: 8, opacity: .65, fontSize: 12 }}>
        {running ? (isPaused ? "En pause" : "En cours") : "Arrêté"}
      </div>
    </div>
  );
}

// petits styles boutons
const btnPrimary: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid #2e5f3a",
  background: "#2f6d3a", color: "#fff", cursor: "pointer"
};
const btnOutline: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid #555",
  background: "transparent", color: "#eaeaea", cursor: "pointer"
};
const btnSm: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, border: "1px solid #555",
  background: "transparent", color: "#eaeaea", cursor: "pointer", fontSize: 14
};
