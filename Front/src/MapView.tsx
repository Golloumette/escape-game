import React from "react";
import { MAP, charAt, isFloorLike } from "./map";
import type { DoorMeta, Item } from "./map";
import type { Player } from "./types";
import { TILES } from "./generated_map_v3";

interface MapViewProps {
  players: Player[];
  doors: DoorMeta[];
  items: Item[];
}

function doorLockedAt(doors: DoorMeta[], x: number, y: number): boolean | null {
  const d = doors.find(dd => dd.x === x && dd.y === y);
  return d ? d.locked : null;
}

function bordersFor(x: number, y: number, doors: DoorMeta[]) {
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
    borderTop:    `2px solid ${edge(isWalk(x, y - 1))}`,
    borderRight:  `2px solid ${edge(isWalk(x + 1, y))}`,
    borderBottom: `2px solid ${edge(isWalk(x, y + 1))}`,
    borderLeft:   `2px solid ${edge(isWalk(x - 1, y))}`,
  };
}

/** Icône visuelle par type d’item (grosse, lisible, centrée) */
function renderItemIcon(kind: Item["kind"]) {
  switch (kind) {
    case "vaccine":
      return "💉";
    case "access-card":
      return "💳";
    case "key-red":
      return "🔑"; // tu peux utiliser "🟥" si tu veux vraiment la couleur
    case "key-blue":
      return "🔑";
    case "key-green":
      return "🔑";
    default:
      return "❓";
  }
}

function renderItem(i: Item, cell: number) {
  return (
    <div
      key={i.id}
      title={i.name}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: cell,
        height: cell,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none", // évite de “bloquer” les clics
      }}
    >
      <span
        aria-label={i.name}
        style={{
          fontSize: Math.floor(cell * 0.8),
          lineHeight: 1,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))",
        }}
      >
        {renderItemIcon(i.kind)}
      </span>
    </div>
  );
}

export default function MapView({ players, doors, items }: MapViewProps) {
  const cell = MAP.cellSize;
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${MAP.width}, ${cell}px)`,
    gridAutoRows: `${cell}px`,
    background: "#808080ff",
    padding: 8,
    border: "2px solid #333",
    width: "fit-content",
    boxShadow: "0 0 12px rgba(0,0,0,0.4)",
    userSelect: "none",
  };

  const charToKind = (c: string) => {
    if (c === "#" || c === (TILES as any).WALL) return "WALL";
    if (c === "D" || c === (TILES as any).DOOR) return "DOOR";
    if (c === "." || c === (TILES as any).FLOOR) return "FLOOR";
    // Dans ta map, le VOID est le caractère guillemet "
    if (c === '"' || c === (TILES as any).VOID) return "VOID";
    return "OTHER";
  };

  const kindToColor = (kind: string, x: number, y: number) => {
    switch (kind) {
      case "WALL":
        return "#303030";
      case "DOOR":
        return doorLockedAt(doors, x, y) ? "#6a3a2f" : "#2f6d3a";
      case "FLOOR":
        return "#b0e6c0ff";
      case "VOID":
        return "transparent";
      default:
        return "#1b1b1b";
    }
  };

  return (
    <div style={gridStyle}>
      {MAP.grid.flatMap((row, y) =>
        row.split("").map((c, x) => {
          const kind = charToKind(c);
          const bg = kindToColor(kind, x, y);
          const outline =
            kind === "FLOOR" || kind === "DOOR" ? bordersFor(x, y, doors) : {};

          const base: React.CSSProperties = {
            width: cell,
            height: cell,
            position: "relative",
            background: bg,
          };

          return (
            <div key={`${x}-${y}`} style={{ ...base, ...outline }}>
              {/* Items au sol (icônes) */}
              {items.filter((it) => it.x === x && it.y === y).map((it) => renderItem(it, cell))}

              {/* Joueurs (tous ceux présents sur cette case) */}
              {players
                .filter((p) => p.x === x && p.y === y)
                .map((p) => (
                  <div
                    key={p.id}
                    title={p.id}
                    style={{
                      position: "absolute",
                      left: 6,
                      top: 6,
                      width: cell - 12,
                      height: cell - 12,
                      borderRadius: "50%",
                      background: p.color ?? "#b43b3b",
                      outline: "1px solid #0008",
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
