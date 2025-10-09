import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import MapView from "./MapView";
import { MAP, DoorMeta, Item } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
import ConfirmModal from "./ConfirmModal";
import DoorModal from "./DoorModal";
import Puzzle from "./Puzzle";
import Timer from "./Timer";

type Inventory = Set<'vaccine' | 'access-card' | 'key-red' | 'key-blue' | 'key-green'>;

// 1) Server URL :
// - Dev local: "http://localhost:4000"
// - Serveur distant: "http://IP_DU_SERVEUR:4000"
// - Prod (recommandé): dans .env : VITE_SERVER_URL="https://ton-domaine.fr" (derrière Nginx)
// On lit l'env d'abord, sinon fallback localhost:
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
type DoorKey = string; // "x,y"
const PLAYER_COLORS = ["#b43b3b", "#3b7bb4", "#3bb45b", "#b4a33b", "#883bb4", "#b43b84"];
function mergeDoors(localDoors: Doorporte[], remoteDoors: Doorporte[]): Doorporte[] {
  const byKey = new Map<DoorKey, Doorporte>();
  for (const d of localDoors) byKey.set(`${d.x},${d.y}`, d);
  for (const r of remoteDoors) {
    const k = `${r.x},${r.y}`;
    // le serveur peut n'envoyer que locked (ou changer son état)
    const base = byKey.get(k) || r;
    byKey.set(k, { ...base, ...r }); // on garde need/local si non envoyé par le serveur
  }
  return Array.from(byKey.values());
}

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

  // --- Réseau ---
  const netRef = useRef<Net | null>(null);
  const myIdRef = useRef<string>("");

  // Crée un joueur local (position initiale à ajuster si tu veux)
  const spawnX = 23, spawnY = 13;
  useEffect(() => {
    const colorIndex = Math.floor(Math.random() * PLAYER_COLORS.length);
    const me: Player = {
      id: crypto.randomUUID(), // ID unique navigateur
      x: spawnX,
      y: spawnY,
      color:PLAYER_COLORS[colorIndex],
    };
    myIdRef.current = me.id;

    // init inventaire pour moi
    setInventory(prev => ({ ...prev, [me.id]: new Set() }));

    // connexion socket
    const socket = connectNet(SERVER_URL);
    netRef.current = socket;

    // rejoindre la room "default"
    socket.emit("join", { room: "default", player: me });

    // État initial reçu du serveur
    socket.on("state:init", (s: any) => {
      const others: Player[] = Object.entries(s.players || {}).map(([id, p]: any) => ({
        id,
        x: p.x,
        y: p.y,
        color: p.color || "#3b7bb4",
      }));
      // ajoute "me" si pas présent dans la map reçue
      const already = others.some(p => p.id === me.id);
      setPlayers(already ? others : [me, ...others]);

      if (Array.isArray(s.doors) && s.doors.length) {
    setDoors(prev => mergeDoors(prev, s.doors));
}
// sinon: ne touche pas; on garde l'init locale (MAP.doors)

      if (Array.isArray(s.items)) {
        setItems(s.items);
      }
    });

    // Événements temps réel
    socket.on("player:join", (p: Player) => {
      setPlayers(prev => (prev.some(pp => pp.id === p.id) ? prev : [...prev, p]));
    });

    socket.on("player:update", (p: Player) => {
      setPlayers(prev => prev.map(pp => (pp.id === p.id ? { ...pp, x: p.x, y: p.y } : pp)));
    });

    socket.on("player:leave", ({ id }: { id: string }) => {
      setPlayers(prev => prev.filter(pp => pp.id !== id));
    });

    socket.on("door:opened", ({ x, y }: { x: number; y: number }) => {
      setDoors(prev => prev.map(d => (d.x === x && d.y === y ? { ...d, locked: false } : d)));
    });

    socket.on("item:removed", ({ id }: { id: string }) => {
      setItems(prev => prev.filter(it => it.id !== id));
    });

    return () => {
      socket.disconnect();
    };
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

  // --- Clavier : IGNORE les touches si on tape dans un input/textarea, ou si une modale est ouverte
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 1) si une modale est ouverte, on ne déplace pas le joueur
      if (doorModal || doorConfirm) return;

      // 2) si le focus est dans un champ texte, on ne déplace pas le joueur
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toUpperCase();
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (active as any)?.isContentEditable;
      if (isTyping) return;
      if ((e as any).isComposing) return; // IME

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
                      setDoors(prev => prev.map(d => (d.x === meta.x && d.y === meta.y ? { ...d, locked: false } : d)));
                      markSolvedIfRelevant(meta);
                      setMsg("Bravo ! Énigme résolue, la porte s'ouvre 🎉");
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
          <h3 style={{ marginTop: 0 }}>Inventaire (toi)</h3>
          {invMine.length ? <ul>{invMine.map(k => <li key={k}>{k}</li>)}</ul> : <p style={{ opacity: 0.8 }}>Vide</p>}
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
