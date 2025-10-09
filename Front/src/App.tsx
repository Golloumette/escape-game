import React, { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import { MAP, isFloorLike, Doorporte, Item } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";
import ConfirmModal from "./ConfirmModal";
import { connectNet, Net } from "./network";
import Timer from "./Timer";

type Inventory = Set<"vaccine" | "access-card" | "key-red" | "key-blue" | "key-green">;


const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://10.56.40.183:4000";
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
  // --- État jeu ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [doors, setDoors] = useState<Doorporte[]>(() => MAP.doors.map(d => ({ ...d })));
  useEffect(() => {
  const probe = [[31,5],[13,6],[31,6],[25,12]] as const;
  for (const [x,y] of probe) {
    const tile = MAP.grid[y]?.[x];
    const meta = doors.find(d => d.x===x && d.y===y);
    console.log(`porte (${x},${y})`, { tile, meta });
    // tile doit être "D"
    // meta.locked doit refléter ton override (false pour 25,12)
  }
}, [doors]);

  const [items, setItems] = useState<Item[]>(() => MAP.items.map(i => ({ ...i })));
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [msg, setMsg] = useState<string>("");

  // Modales
  const [doorConfirm, setDoorConfirm] = useState<null | {
    pid: string;
    x: number;
    y: number;
    need?: Doorporte["need"];
  }>(null);

  const [doorModal, setDoorModal] = useState<null | {
    x: number;
    y: number;
    need?: Doorporte["need"];
  }>(null);

  // --- Réseau ---
  const netRef = useRef<Net | null>(null);
  const myIdRef = useRef<string>("");

  function getOrCreateClientId(): string {
  const k = 'client_id';
  const saved = localStorage.getItem(k);
  if (saved) return saved;
  const id = (typeof crypto?.randomUUID === 'function')
    ? crypto.randomUUID()
    : `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  localStorage.setItem(k, id);
  return id;
}
  // Crée un joueur local (position initiale à ajuster si tu veux)
  const spawnX = 23, spawnY = 13;
  useEffect(() => {
    const colorIndex = Math.floor(Math.random() * PLAYER_COLORS.length);
    const me: Player = {
      id: getOrCreateClientId(), // ID unique navigateur
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

  // Aides inventaire / conditions
  const hasRequirement = (pid: string, need?: Doorporte["need"]) => {
    if (!need) return true;
    const inv = inventory[pid] ?? new Set();
    if (need === "access") return inv.has("access-card");
    return inv.has(`key-${need}` as const);
  };

  // Autorisation d'entrée dans la case (blocage murs, portes verrouillées)
  const canEnter = (pid: string, nx: number, ny: number): boolean => {
    const c = MAP.grid[ny]?.[nx];
    if (!c || c === TILES.WALL || c === TILES.VOID) return false;
    if (c === TILES.FLOOR) return true;

  if (c === TILES.DOOR) {
  const porte = doors.find(d => d.x === nx && d.y === ny);

  // ❗ Par défaut, une porte sans entrée dans doors = VERROUILLÉE
  if (!porte) {
    setMsg("Porte verrouillée.");
    return false;
  }

  // Porte déjà ouverte
  if (!porte.locked) return true;

  // Porte verrouillée : si on a la clé / carte, on propose d’ouvrir
  if (hasRequirement(pid, porte.need)) {
    setDoorConfirm({ pid, x: nx, y: ny, need: porte.need });
    setMsg("Voulez-vous ouvrir cette porte ?");
    return false; // on attend la réponse Oui/Non
  }

  setMsg("Porte verrouillée.");
  return false;
}

    return false;
  };

  // Ramassage d'objets
  const pickupAt = (pid: string, x: number, y: number) => {
    const here = items.filter(i => i.x === x && i.y === y);
    if (!here.length) return;
    setItems(prev => prev.filter(i => !(i.x === x && i.y === y)));
    setInventory(prev => {
      const copy = { ...prev };
      const inv = new Set(copy[pid] ?? []);
      let name = "";
      here.forEach(it => {
        inv.add(it.kind as any);
        name = it.name;
        // broadcast suppression côté serveur
        netRef.current?.emit("item:pickup", { id: it.id });
      });
      copy[pid] = inv;
      setMsg(`Objet ramassé : ${name}`);
      return copy;
    });
  };

  // Déplacement clavier (contrôle uniquement "moi" ici)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const pid = myIdRef.current;
      if (!pid) return;

      const move: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0],
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

          // Broadcast déplacement
          netRef.current?.emit("player:move", { x: nx, y: ny });

          // Ramassage
          pickupAt(pid, nx, ny);
          return arr;
        }
        return prev;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    
  }, [doors, items, inventory]);

  const invMine = useMemo(() => {
    const pid = myIdRef.current;
    return Array.from(inventory[pid] ?? []);
  }, [inventory]);

  return (
    <div style={{ minHeight: "100vh", background: "#525050ff", color: "#eaeaea", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16, gridTemplateColumns: "1fr 280px" }}>
        <div>
          <h1 style={{ marginBottom: 12 }}>Bâtiment (portes & objets) — Multi</h1>
          <p style={{ opacity: 0.85, marginBottom: 12 }}>
            ZQSD / Flèches pour bouger. Les autres navigateurs connectés sont synchronisés via Socket.IO.
          </p>

          <MapView players={players} doors={doors} items={items} />

          {/* Confirmation d'ouverture de porte */}
          {doorConfirm && (
            <ConfirmModal
              title={`Porte (${doorConfirm.x},${doorConfirm.y})`}
              message={
                doorConfirm.need
                  ? `Cette porte nécessite ${
                      doorConfirm.need === "access" ? "une carte d'accès" : `la clé ${doorConfirm.need}`
                    }. Ouvrir ?`
                  : "Ouvrir cette porte ?"
              }
              onNo={() => {
                setDoorConfirm(null);
                setMsg("Vous laissez la porte fermée.");
              }}
              onYes={() => {
                // 1) Déverrouiller localement
                setDoors(prev =>
                  prev.map(d => (d.x === doorConfirm.x && d.y === doorConfirm.y ? { ...d, locked: false } : d))
                );
                setMsg("Porte ouverte.");

                // 2) Broadcast aux autres
                netRef.current?.emit("door:open", { x: doorConfirm.x, y: doorConfirm.y });

                // 3) Ouvrir la pop-up (contenu)
                setDoorModal({ x: doorConfirm.x, y: doorConfirm.y, need: doorConfirm.need });

                // 4) Fermer la confirmation
                setDoorConfirm(null);
              }}
            />
          )}

          {/* Pop-up de contenu après ouverture de porte */}
          {doorModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "grid",
                placeItems: "center",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  width: 520,
                  maxWidth: "95vw",
                  background: "#141414",
                  color: "#eaeaea",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0 }}>Bureau</h2>
                  <button
                    onClick={() => setDoorModal(null)}
                    style={{
                      background: "transparent",
                      color: "#eaeaea",
                      border: "1px solid #444",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Fermer
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {/* Image issue de /public */}
                  <img
                    src="/bureau.webp"
                    alt="Bureau"
                    style={{ width: "100%", height: "auto", borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside style={{ background: "#188162ff", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12 }}>
           <Timer
                initialSeconds={30 * 60}        
                autoStart={true}
                paused={!!doorModal}           // pause automatique si une pop-up s'affiche
                onExpire={() => {
                setMsg("⛔ Temps écoulé !");
      // ici tu peux ouvrir une modale "Game Over", revenir au menu, etc.
    }}></Timer>
          <h3 style={{ marginTop: 0 }}>Inventaire (toi)</h3>
          {invMine.length ? <ul>{invMine.map(k => <li key={k}>{k}</li>)}</ul> : <p style={{ opacity: 0.8 }}>Vide</p>}
          <h3>Infos</h3>
          <p style={{ minHeight: 40, background: "#101010", border: "1px solid #2a2a2a", borderRadius: 6, padding: 8 }}>
            {msg || "—"}
          </p>
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
