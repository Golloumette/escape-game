import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import { MAP, isFloorLike, doorAt, DoorMeta, Item, itemsAt } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
import ConfirmModal from "./ConfirmModal";
type Inventory = Set<'vaccine' | 'access-card' | 'key-red' | 'key-blue' | 'key-green'>;



export default function App() {
  // ⬇️ multi-joueur côté front (local) : un tableau de joueurs

  const [players, setPlayers] = useState<Player[]>([
    { id: "P1", x: 23, y: 13, color: "#b43b3b" },
    { id: "P2", x: 23, y: 14, color: "#3b7bb4" }

  ]);
  const [doorModal, setDoorModal] = useState<null | { x: number; y: number; need?: DoorMeta['need'] }>(null);
  const [doors, setDoors] = useState<DoorMeta[]>(() => MAP.doors.map(d => ({ ...d })));
  const [items, setItems] = useState<Item[]>(() => MAP.items.map(i => ({ ...i })));
  const [inventory, setInventory] = useState<Record<string, Inventory>>({
    P1: new Set(),
  });
  const [msg, setMsg] = useState<string>("");

  const [doorConfirm, setDoorConfirm] = useState<null | {
  pid: string;
  x: number;
  y: number;
  need?: DoorMeta['need'];
}>(null);
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
    if (!meta) return true;        // porte sans meta => passable
    if (!meta.locked) return true; // déjà ouverte

    // Porte verrouillée : a-t-on la clé / la carte ?
    if (hasRequirement(pid, meta.need)) {
      // 👉 On propose d'ouvrir, mais on n'ouvre pas encore
      setDoorConfirm({ pid, x: nx, y: ny, need: meta.need });
      setMsg("Voulez-vous ouvrir cette porte ?");
      return false; // on reste devant la porte en attendant la réponse
    }

    setMsg("Porte verrouillée.");
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // on contrôle P1 au clavier (les autres joueurs pourront venir du réseau)
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
          // ramassage après déplacement
          pickupAt(pid, nx, ny);
          return arr;
        }
        return prev;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doors, items, inventory]);

  const invP1 = useMemo(() => Array.from(inventory["P1"] ?? []), [inventory]);

  return (
    <div style={{ minHeight: "100vh", background: "#525050ff", color: "#eaeaea", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}>
        <div>
          <h1 style={{ marginBottom: 12 }}>Bâtiment (portes & objets)</h1>
          <p style={{ opacity: .85, marginBottom: 12 }}>
            ZQSD / Flèches pour bouger le joueur P1. 
          </p>
          <MapView players={players} doors={doors} items={items} />
          {doorConfirm && (
  <ConfirmModal
    title={`Porte (${doorConfirm.x},${doorConfirm.y})`}
    message={
      doorConfirm.need
        ? `Cette porte nécessite ${doorConfirm.need === 'access' ? "une carte d'accès" : `la clé ${doorConfirm.need}`}. Ouvrir ?`
        : "Ouvrir cette porte ?"
    }
    onNo={() => {
      setDoorConfirm(null);              // fermer la confirmation
      setMsg("Vous laissez la porte fermée.");
    }}
    onYes={() => {
      // 1) Déverrouiller la porte
      setDoors(prev =>
        prev.map(d => (d.x === doorConfirm.x && d.y === doorConfirm.y ? { ...d, locked: false } : d))
      );
      setMsg("Porte ouverte.");

      // 2) Ouvrir la pop-up (ta modale de contenu)
      setDoorModal({ x: doorConfirm.x, y: doorConfirm.y, need: doorConfirm.need });

      // 3) Fermer la confirmation
      setDoorConfirm(null);
    }}
  />
)}
{doorModal && (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "grid", placeItems: "center", zIndex: 9999
  }}>
    <div style={{
      width: 520, maxWidth: "95vw",
      background: "#141414", color: "#eaeaea",
      border: "1px solid #2a2a2a", borderRadius: 12, padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h2 style={{ margin: 0 }}>Bureau</h2>
        <button onClick={() => setDoorModal(null)} style={{
          background:"transparent", color:"#eaeaea", border:"1px solid #444",
          borderRadius:6, padding:"4px 8px", cursor:"pointer"
        }}>Fermer</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <img
          src="/bureau.webp"              
          alt="Bureau"
          style={{ width:"100%", height:"auto", borderRadius: 8 }}
        />
      </div>
    </div>
  </div>
)}

        </div>
        <aside style={{ background: "#188162ff", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Inventaire P1</h3>
          {invP1.length ? <ul>{invP1.map(k => <li key={k}>{k}</li>)}</ul> : <p style={{ opacity: .8 }}>Vide</p>}
          <h3>Infos</h3>
          <p style={{ minHeight: 40, background: "#101010", border: "1px solid #2a2a2a", borderRadius: 6, padding: 8 }}>{msg || "—"}</p>
          <h3>Légende</h3>
          <ul>
            <li>Murs = gris foncé</li>
            <li>Porte fermée = brun/rouge</li>
            <li>Porte ouverte = vert</li>
            <li>Vide (`"`) = transparent (hors carte)</li>
            <li>Objets : V=Vaccin, A=Carte, R/B/G=Clés</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
