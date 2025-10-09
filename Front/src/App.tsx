import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import MapView from "./MapView";
import { MAP, DoorMeta, Item } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
import ConfirmModal from "./ConfirmModal";
import DoorModal from "./DoorModal";
import Puzzle from "./Puzzle";
import Timer from './Timer';

type Inventory = Set<'vaccine' | 'access-card' | 'key-red' | 'key-blue' | 'key-green'>;

const keyOf = (x: number, y: number) => `${x},${y}`;

export default function App() {
  // --- Players
  const [players, setPlayers] = useState<Player[]>([
    { id: "P1", x: 23, y: 13, color: "#b43b3b" },
    { id: "P2", x: 23, y: 14, color: "#3b7bb4" }
  ]);

  // --- World state
  const [doors, setDoors] = useState<DoorMeta[]>(() => MAP.doors.map(d => ({ ...d })));
  const [items, setItems] = useState<Item[]>(() => MAP.items.map(i => ({ ...i })));
  const [inventory, setInventory] = useState<Record<string, Inventory>>({ P1: new Set() });
  const [msg, setMsg] = useState<string>("");

  // --- UI modals
  const [doorConfirm, setDoorConfirm] = useState<null | { pid: string; x: number; y: number; need?: DoorMeta['need'] }>(null);
  const [doorModal, setDoorModal] = useState<null | { x: number; y: number; need?: DoorMeta['need'] }>(null);

  // === Progression: 6 portes ouvrent les finales
  const solvedNonAccess = useRef<Set<string>>(new Set());
  const TARGET_SOLVED = 6;

  const markSolvedIfRelevant = useCallback((d: DoorMeta) => {
    if (d.need === "access") return;
    solvedNonAccess.current.add(keyOf(d.x, d.y));
  }, []);

  const maybeUnlockAccessDoors = useCallback(() => {
    const solved = solvedNonAccess.current.size;
    if (solved >= TARGET_SOLVED) {
      const hasLockedAccess = doors.some(d => d.locked && d.need === "access");
      if (hasLockedAccess) {
        setDoors(prev => prev.map(d => (d.locked && d.need === "access" ? { ...d, locked: false } : d)));
        setMsg(`🎉 Vous avez ouvert ${solved} portes : les portes à carte d'accès sont maintenant déverrouillées !`);
      }
    }
  }, [doors]);

  useEffect(() => { maybeUnlockAccessDoors(); }, [doors, maybeUnlockAccessDoors]);

  // --- Helpers
  const hasRequirement = (pid: string, need?: DoorMeta['need']) => {
    if (!need) return true;
    const inv = inventory[pid] ?? new Set();
    if (need === 'access') return inv.has('access-card');
    return inv.has(`key-${need}` as const);
  };

  const canEnter = (pid: string, nx: number, ny: number): boolean => {
    const c = MAP.grid[ny]?.[nx];
    if (!c || c === TILES.WALL || c === TILES.VOID) return false;
    if (c === TILES.FLOOR) return true;

    if (c === TILES.DOOR) {
      const meta = doors.find(d => d.x === nx && d.y === ny);
      if (!meta) return true;
      if (!meta.locked) return true;

      if (hasRequirement(pid, meta.need)) {
        setDoorConfirm({ pid, x: nx, y: ny, need: meta.need });
        setMsg("Voulez-vous ouvrir cette porte ?");
        return false;
      }
      setMsg(meta.need === "access" ? "Porte verrouillée : carte d'accès requise." : `Porte verrouillée : clé ${meta.need} requise.`);
      return false;
    }
    return false;
  };

  const pickupAt = (pid: string, x: number, y: number) => {
    const here = items.filter(i => i.x === x && i.y === y);
    if (!here.length) return;
    setItems(prev => prev.filter(i => !(i.x === x && i.y === y)));
    setInventory(prev => {
      const copy = { ...prev };
      const inv = new Set(copy[pid] ?? []);
      let name = "";
      here.forEach(it => { inv.add(it.kind as any); name = it.name; });
      copy[pid] = inv;
      setMsg(`Objet ramassé : ${name}`);
      return copy;
    });
  };

  // --- Clavier : ignorer quand on tape dans un input/textarea ou si une modale est ouverte
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (doorModal || doorConfirm) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toUpperCase();
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (active as any)?.isContentEditable;
      if (isTyping) return;
      if ((e as any).isComposing) return;

      const pid = "P1";
      const move: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0]
      };
      const vec = move[e.key];
      if (!vec) return;
      e.preventDefault();
      setPlayers(prev => {
        const arr = [...prev];
        const i = arr.findIndex(p => p.id === pid);
        if (i < 0) return prev;
        const p = arr[i];
        const nx = p.x + vec[0], ny = p.y + vec[1];
        if (canEnter(pid, nx, ny)) {
          arr[i] = { ...p, x: nx, y: ny };
          pickupAt(pid, nx, ny);
          return arr;
        }
        return prev;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doors, items, inventory, doorModal, doorConfirm]);

  // === UI derived
  const invP1 = useMemo(() => Array.from(inventory["P1"] ?? []), [inventory]);
  const vaccinesCount = useMemo(() => invP1.filter(k => k === "vaccine").length, [invP1]);
  const lockedNow = useMemo(() => doors.filter(d => d.locked), [doors]);
  const lockedAccessNow = useMemo(() => lockedNow.filter(d => d.need === "access"), [lockedNow]);
  const lockedNonAccessNow = useMemo(() => lockedNow.filter(d => d.need !== "access"), [lockedNow]);
  const solved = solvedNonAccess.current.size;

  return (
    <div style={{ minHeight: "100vh", background: "#525050ff", color: "#eaeaea", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1180, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16, gridTemplateColumns: "1fr 340px" }}>
        <div>
          <h1 style={{ marginBottom: 12 }}>Bâtiment (portes & énigmes)</h1>
          <p style={{ opacity: .85, marginBottom: 12 }}>ZQSD / Flèches pour bouger le joueur P1.</p>

          <MapView players={players} doors={doors} items={items} />

          {/* ===== Confirmation ===== */}
          {doorConfirm && (
            <ConfirmModal
              title={`Porte (${doorConfirm.x},${doorConfirm.y})`}
              message={
                doorConfirm.need
                  ? `Cette porte nécessite ${doorConfirm.need === 'access'
                      ? "une carte d'accès"
                      : `la clé ${doorConfirm.need}`}. Ouvrir ?`
                  : "Ouvrir cette porte ?"
              }
              onNo={() => { setDoorConfirm(null); setMsg("Vous laissez la porte fermée."); }}
              onYes={() => {
                setDoorModal({ x: doorConfirm!.x, y: doorConfirm!.y, need: doorConfirm!.need });
                setMsg("Répondez à l'énigme pour ouvrir la porte.");
                setDoorConfirm(null);
              }}
            />
          )}

          {/* ===== Modale d'énigme ===== */}
          {doorModal && (
            <DoorModal title={`Porte (${doorModal.x},${doorModal.y})`} onClose={() => setDoorModal(null)}>
              {(() => {
                const meta = doors.find(d => d.x === doorModal.x && d.y === doorModal.y);
                if (!meta) return <p>Erreur: porte inconnue.</p>;
                if (meta.need === "access") return <p>Cette porte s'ouvrira automatiquement après 6 énigmes résolues.</p>;
                const r = meta.riddle;
                if (!r) return <p>Pas d’énigme pour cette porte.</p>;
                return (
                  <Puzzle
                    riddle={r}
                    onSolved={() => {
                      // Ouvrir cette porte
                      setDoors(prev => prev.map(d => (d.x === meta.x && d.y === meta.y ? { ...d, locked: false } : d)));
                      // Marquer progression
                      solvedNonAccess.current.add(keyOf(meta.x, meta.y));
                      // Donner la récompense si définie
                      if (meta.reward === "vaccine") {
                        setInventory(prev => {
                          const copy = { ...prev };
                          const inv = new Set(copy["P1"] ?? []);
                          inv.add("vaccine");
                          copy["P1"] = inv;
                          return copy;
                        });
                        setMsg("🎁 Récompense: vous avez obtenu un vaccin.");
                      } else {
                        setMsg("Bravo ! Énigme résolue, la porte s'ouvre 🎉");
                      }
                      setDoorModal(null);
                    }}
                  />
                );
              })()}
            </DoorModal>
          )}
        </div>

        {/* ===== Sidebar ===== */}
        <aside style={{ background: "#188162ff", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
            <Timer
                initialSeconds={30 * 60}        
                autoStart={true}
                paused={!!doorModal}           // pause automatique si une pop-up s'affiche
                onExpire={() => {
                setMsg("⛔ Temps écoulé !");
      // ici tu peux ouvrir une modale "Game Over", revenir au menu, etc.
           }}> </Timer>
          <h3>Inventaire P1</h3>
          {invP1.length ? <ul>{invP1.map(k => <li key={k}>{k}</li>)}</ul> : <p>Vide</p>}

          <p style={{ marginTop: 8 }}>💉 Vaccins : <b>{vaccinesCount}</b></p>

          <h3>Infos</h3>
          <p style={{ minHeight: 40, background: "#101010", border: "1px solid #2a2a2a", borderRadius: 6, padding: 8 }}>
            {msg || "—"}
          </p>

          <h3>Progression</h3>
          <p>Énigmes résolues : <b>{solved}</b> / <b>{TARGET_SOLVED}</b></p>
          {solved < TARGET_SOLVED ? (
            <p style={{ opacity: .9 }}>Résolvez {TARGET_SOLVED - solved} énigmes supplémentaires pour débloquer les portes finales.</p>
          ) : (
            <p style={{ color: "#00ff88" }}>Les portes finales sont maintenant accessibles 🔓</p>
          )}

          <h3>État des portes</h3>
          <p>Verrouillées (hors access) : {lockedNonAccessNow.length}</p>
          <p>Verrouillées (access) : {lockedAccessNow.length}</p>
        </aside>
      </div>
    </div>
  );
}
