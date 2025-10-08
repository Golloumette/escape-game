import React from "react";
import { MAP, charAt, isFloorLike } from "./map";
import type { Doorporte, Item } from "./map";
import type { Player } from "./types";   
import { TILES } from "./generated_map_v3";
interface MapViewProps {
  players: Player[];   
  doors:Doorporte[];
  items: Item[];
}

function doorLockedAt(doors: Doorporte[], x: number, y: number): boolean {
  const d = doors.find(dd => dd.x === x && dd.y === y);
  // ❗ si pas de méta, on considère la porte comme verrouillée
  return d ? d.locked : true;
}


function bordersFor(x: number, y: number, doors: Doorporte[]) {
  const isWalk = (cx: number, cy: number) => {
    const c = charAt(cx, cy);
    if (!isFloorLike(c)) return false;
    if (c === TILES.DOOR) {
      const locked = doorLockedAt(doors, cx, cy);
      return locked === false;
    }
    return true;
  };
  const edge = (ok: boolean) => (ok ? "transparent" : "#8a8a8a");
  return {
    borderTop:    `2px solid ${edge(isWalk(x, y-1))}`,
    borderRight:  `2px solid ${edge(isWalk(x+1, y))}`,
    borderBottom: `2px solid ${edge(isWalk(x, y+1))}`,
    borderLeft:   `2px solid ${edge(isWalk(x-1, y))}`,
  };
}

function renderItem(i: Item) {
  const label =
    i.kind === "vaccine" ? "V" :
    i.kind === "access-card" ? "A" :
    i.kind === "key-red" ? "R" :
    i.kind === "key-blue" ? "B" :
    i.kind === "key-green" ? "G" : "?";
  return (
    <div key={i.id} title={i.name}
      style={{ position:"absolute", inset:8, borderRadius:6, border:"1px solid #ddd",
               background:"#202a44", display:"grid", placeItems:"center", fontSize:14, fontWeight:700 }}>
      {label}
    </div>
  );
}

export default function MapView({ players, doors, items }: MapViewProps) {
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${MAP.width}, ${MAP.cellSize}px)`,
    gridAutoRows: `${MAP.cellSize}px`,
    background: "#808080ff",
    padding: 8,
    border: "2px solid #333",
    width: "fit-content",
    boxShadow: "0 0 12px rgba(0,0,0,0.4)"
  };

  return (
    <div style={gridStyle}>
      {MAP.grid.flatMap((row, y) =>
        row.split("").map((c, x) => {
          const bg =
            c === TILES.WALL ? "#303030" :
            c === TILES.DOOR ? (doorLockedAt(doors, x, y) ? "#6a3a2f" : "#2f6d3a") :
            c === TILES.FLOOR ? "#b0e6c0ff" :
            c === TILES.VOID ? "transparent" : "#1b1b1b";

          const base: React.CSSProperties = {
            width: MAP.cellSize, height: MAP.cellSize, position:"relative", background: bg
          };
          const outline = isFloorLike(c) ? bordersFor(x, y, doors) : {};

          return (
            <div key={`${x}-${y}`} style={{ ...base, ...outline }}>
              {items.filter(it => it.x === x && it.y === y).map(renderItem)}
              {/* multi-joueur : on dessine tous les joueurs présents sur cette case */}
              {players.filter(p => p.x === x && p.y === y).map(p => (
                <div key={p.id}
                  title={p.id}
                  style={{
                    position:"absolute", inset:6, borderRadius:"50%",
                    background: p.color ?? "#b43b3b",
                    outline:"1px solid #0008"
                  }}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
