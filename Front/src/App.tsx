import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import MapView from "./MapView";
import { MAP, Doorporte, Item } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
import ConfirmModal from "./ConfirmModal";
import DoorModal from "./DoorModal";
import Puzzle from "./Puzzle";
import Timer from "./Timer";
import { connectNet, Net } from "./network";

type Inventory = Set<'vaccine' | 'access-card' | 'key-red' | 'key-blue' | 'key-green'>;

// --- Réseau ---
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://10.56.40.183:4000";

type DoorKey = string; // "x,y"
const PLAYER_COLORS = ["#b43b3b", "#3b7bb4", "#3bb45b", "#b4a33b", "#883bb4", "#b43b84"];

// Progression énigmes (manquants dans le code reçu)
const TARGET_SOLVED = 6;
const solvedNonAccess = { current: new Set<string>() };
function markSolvedIfRelevant(meta: Doorporte) {
  if (meta.need !== "access") solvedNonAccess.current.add(`${meta.x},${meta.y}`);
}

function mergeDoors(localDoors: Doorporte[], remoteDoors: Doorporte[]): Doorporte[] {
  const byKey = new Map<DoorKey, Doorporte>();
  for (const d of localDoors) byKey.set(`${d.x},${d.y}`, d);
  for (const r of remoteDoors) {
    const k = `${r.x},${r.y}`;
    const base = byKey.get(k) || r;
    byKey.set(k, { ...base, ...r });
  }
  return Array.from(byKey.values());
}

function getOrCreateClientId(): string {
  const k = "client_id";
  const saved = localStorage.getItem(k);
  if (saved) return saved;
  const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  localStorage.setItem(k, id);
  return id;
}

export default function App() {
  // --- Players / World ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [doors, setDoors] = useState<Doorporte[]>(() => MAP.doors.map(d => ({ ...d })));
  const [items, setItems] = useState<Item[]>(() => MAP.items.map(i => ({ ...i })));
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [msg, setMsg] = useState<string>("");

  // UI modales
  const [doorConfirm, setDoorConfirm] = useState<null | { pid: string; x: number; y: number; need?: Doorporte['need'] }>(null);
  const [doorModal, setDoorModal] = useState<null | { x: number; y: number; need?: Doorporte['need'] }>(null);

  // Réseau
  const netRef = useRef<Net | null>(null);
  const myIdRef = useRef<string>("");

  // Création du joueur local
  const spawnX = 23, spawnY = 13;

  // Éviter double init en dev (StrictMode)
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const colorIndex = Math.floor(Math.random() * PLAYER_COLORS.length);
    const me: Player = {
      id: getOrCreateClientId(),
      x: spawnX,
      y: spawnY,
      color: PLAYER_COLORS[colorIndex],
    };
    myIdRef.current = me.id;

    // voir tout de suite mon pion en local (le serveur harmonisera ensuite)
    setPlayers(prev => (prev.some(p => p.id === me.id) ? prev : [me, ...prev]));
    setInventory(prev => ({ ...prev, [me.id]: new Set() }));

    const socket = connectNet(SERVER_URL);
    netRef.current = socket;

    socket.on("connect", () => console.log("socket connected:", (socket as any).id));
    socket.emit("join", { room: "default", player: me });

    socket.on("state:init", (s: any) => {
      const others: Player[] = Object.entries(s.players || {}).map(([id, p]: any) => ({
        id, x: p.x, y: p.y, color: p.color || "#3b7bb4",
      }));
      const already = others.some(p => p.id === me.id);
      setPlayers(already ? others : [me, ...others]);

      if (Array.isArray(s.doors) && s.doors.length) setDoors(prev => mergeDoors(prev, s.doors));
      if (Array.isArray(s.items)) setItems(s.items);
    });

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

    return () => { socket.disconnect(); };
  }, []);

  // Déblocage automatique des portes "access" après N énigmes
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

  // Conditions d'entrée + inventaire
  const hasRequirement = (pid: string, need?: Doorporte['need']) => {
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
      if (!meta) return false;              // par défaut: verrouillé si pas de meta
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
      here.forEach(it => { inv.add(it.kind as any); name = it.name; netRef.current?.emit("item:pickup", { id: it.id }); });
      copy[pid] = inv;
      setMsg(`Objet ramassé : ${name}`);
      return copy;
    });
  };

  // Déplacement clavier (contrôle uniquement "moi")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (doorModal || doorConfirm) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toUpperCase();
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (active as any)?.isContentEditable;
      if (isTyping || (e as any).isComposing) return;

      const pid = myIdRef.current;
      if (!pid) return;

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
          const updated = { ...p, x: nx, y: ny };
          arr[i] = updated;

          netRef.current?.emit("player:move", { x: nx, y: ny });
          pickupAt(pid, nx, ny);
          return arr;
        }
        return prev;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doors, items, inventory, doorModal, doorConfirm]);

  const invMine = useMemo(() => {
    const pid = myIdRef.current;
    return Array.from(inventory[pid] ?? []);
  }, [inventory]);

  const lockedNow = useMemo(() => doors.filter(d => d.locked), [doors]);
  const lockedAccessNow = useMemo(() => lockedNow.filter(d => d.need === "access"), [lockedNow]);
  const lockedNonAccessNow = useMemo(() => lockedNow.filter(d => d.need !== "access"), [lockedNow]);
  const solved = solvedNonAccess.current.size;

  return (
    <div style={{ minHeight: "100vh", background: "#525050ff", color: "#eaeaea", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1180, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16, gridTemplateColumns: "1fr 340px" }}>
        <div>
          <h1 style={{ marginBottom: 12 }}>Bâtiment (portes & énigmes)</h1>
          <p style={{ opacity: .85, marginBottom: 12 }}>ZQSD / Flèches pour bouger.</p>

          <MapView players={players} doors={doors} items={items} />

          {doorConfirm && (
            <ConfirmModal
              title={`Porte (${doorConfirm.x},${doorConfirm.y})`}
              message={
                doorConfirm.need
                  ? `Cette porte nécessite ${doorConfirm.need === 'access' ? "une carte d'accès" : `la clé ${doorConfirm.need}`}. Ouvrir ?`
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

          {doorModal && (
            <DoorModal title={`Porte (${doorModal.x},${doorModal.y})`} onClose={() => setDoorModal(null)}>
              {(() => {
                const meta = doors.find(d => d.x === doorModal.x && d.y === doorModal.y);
                if (!meta) return <p>Erreur: porte inconnue.</p>;
                if (meta.need === "access") return <p>Cette porte s'ouvrira automatiquement après {TARGET_SOLVED} énigmes résolues.</p>;
                const r = (meta as any).riddle;
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

        <aside style={{ background: "#188162ff", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
          <Timer
            initialSeconds={30 * 60}
            autoStart={true}
            paused={!!doorModal}
            onExpire={() => setMsg("⛔ Temps écoulé !")}
          />
          <h3 style={{ marginTop: 0 }}>Inventaire (toi)</h3>
          {invMine.length ? <ul>{invMine.map(k => <li key={k}>{k}</li>)}</ul> : <p style={{ opacity: 0.8 }}>Vide</p>}

          <h3>Infos</h3>
          <p style={{ minHeight: 40, background: "#101010", border: "1px solid #2a2a2a", borderRadius: 6, padding: 8 }}>
            {msg || "—"}
          </p>

          <h3>Progression</h3>
          <p>Énigmes résolues : <b>{solved}</b> / <b>{TARGET_SOLVED}</b></p>
          {solved < TARGET_SOLVED
            ? <p style={{ opacity: .9 }}>Résolvez {TARGET_SOLVED - solved} énigmes supplémentaires pour débloquer les portes finales.</p>
            : <p style={{ color: "#00ff88" }}>Les portes finales sont maintenant accessibles 🔓</p>}

          <h3>État des portes</h3>
          <p>Verrouillées (hors access) : {lockedNonAccessNow.length}</p>
          <p>Verrouillées (access) : {lockedAccessNow.length}</p>
        </aside>
      </div>
    </div>
  );
}
