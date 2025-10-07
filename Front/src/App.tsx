import React, { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import { MAP, isFloorLike, doorAt, DoorMeta, Item, itemsAt } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
type Inventory = Set<'vaccine' | 'access-card' | 'key-red' | 'key-blue' | 'key-green'>;

function findFirstFloor(): { x: number; y: number } {
  for (let y = 0; y < MAP.height; y++) {
    for (let x = 0; x < MAP.width; x++) {
      if (isFloorLike(MAP.grid[y][x])) return { x, y };
    }
  }
  return { x: 1, y: 1 };
}

export default function App() {
  // ⬇️ multi-joueur côté front (local) : un tableau de joueurs
  const spawn = findFirstFloor();
  const [players, setPlayers] = useState<Player[]>([
    { id: "P1", x: spawn.x, y: spawn.y, color: "#b43b3b" },
    // tu pourras en ajouter d’autres (ex: { id:"P2", x:..., y:..., color:"#3b7bb4" })
  ]);

  const [doors, setDoors]   = useState<DoorMeta[]>(() => MAP.doors.map(d => ({ ...d })));
  const [items, setItems]   = useState<Item[]>(() => MAP.items.map(i => ({ ...i })));
  const [inventory, setInventory] = useState<Record<string, Inventory>>({
    P1: new Set(),
  });
  const [msg, setMsg] = useState<string>("");

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
        setDoors(prev => prev.map(d => (d.x === nx && d.y === ny ? { ...d, locked: false } : d)));
        setMsg(meta.need ? `Porte déverrouillée (${meta.need})` : "Porte ouverte.");
        return true;
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
      const move: Record<string,[number,number]> = {
        ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0],
        z:[0,-1], s:[0,1], q:[-1,0], d:[1,0]
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
    <div style={{ minHeight: "100vh", background:"#525050ff", color:"#eaeaea", fontFamily:"system-ui" }}>
      <div style={{ maxWidth: 1100, margin:"24px auto", padding:"0 16px", display:"grid", gap:16, gridTemplateColumns:"1fr 280px" }}>
        <div>
          <h1 style={{ marginBottom: 12 }}>Bâtiment (portes & objets)</h1>
          <p style={{ opacity:.85, marginBottom:12 }}>
            ZQSD / Flèches pour bouger le joueur P1. Les autres joueurs pourront venir du réseau plus tard.
          </p>
          <MapView players={players} doors={doors} items={items} />
        </div>
        <aside style={{ background:"#188162ff", border:"1px solid #2a2a2a", borderRadius:8, padding:12 }}>
          <h3 style={{ marginTop:0 }}>Inventaire P1</h3>
          {invP1.length ? <ul>{invP1.map(k => <li key={k}>{k}</li>)}</ul> : <p style={{opacity:.8}}>Vide</p>}
          <h3>Infos</h3>
          <p style={{ minHeight:40, background:"#101010", border:"1px solid #2a2a2a", borderRadius:6, padding:8 }}>{msg || "—"}</p>
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
