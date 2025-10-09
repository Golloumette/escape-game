import {
  GRID,
  DOORS as IMPORTED_DOORS,
  WIDTH,
  HEIGHT,
  CELL,
  TILES,          
} from "./generated_map_v3";


export type KeyColor = "red" | "blue" | "green";
export type ItemKind =
  | "vaccine"
  | "access-card"
  | "key-red"
  | "key-blue"
  | "key-green";

export type TileChar = typeof TILES[keyof typeof TILES];

export interface Room {
  name: string;
  // rectangle inclusif
  x1: number; y1: number; x2: number; y2: number;
}

export interface Doorporte {
  x: number;
  y: number;
  locked: boolean;
  // si présent, nécessite cette clé/carte pour se déverrouiller
  need?: KeyColor | "access";
}

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  x: number;
  y: number;
}

export interface MapData {
  width: number;
  height: number;
  grid: string[];     // lignes de même longueur
  rooms: Room[];
  doors: Doorporte[];
  items: Item[];
  cellSize: number;
}

// 3) Helpers lisibles
export function isVoid(c: string | null): boolean {
  return c === TILES.VOID;
}
export function isWall(c: string | null): boolean {
  return c === TILES.WALL;
}
export function isDoor(c: string | null): boolean {
  return c === TILES.DOOR;
}
export function isFloorLike(c: string | null): boolean {
  return c === TILES.FLOOR || c === TILES.DOOR;
}
export function isWalkable(c: string | null): boolean {

  return isFloorLike(c);
}
// 4) Fonctions utilitaires
export function charAt(x: number, y: number): string | null {
  if (y < 0 || y >= HEIGHT) return null;
  if (x < 0 || x >= WIDTH) return null;
  return GRID[y][x];
}

const DOOR_REQUIREMENTS: Record<string, { need?: Doorporte["need"]; locked?: boolean }> = {

};
export const ITEMS: Item[] = [
];
// 7) Tes salles (idem : optionnel et à ajuster)
export const ROOMS: Room[] = [
 
];

// 8) Construction de la MAP finale
export const MAP: MapData = {
  width: WIDTH,
  height: HEIGHT,
  grid: GRID,
  cellSize: CELL,
  rooms: ROOMS,
 doors: IMPORTED_DOORS.map((d) => {
  const key = `${d.x},${d.y}`;
  const extra = DOOR_REQUIREMENTS[key];
  const result: Doorporte = {
    x: d.x,
    y: d.y,
    // locked reste toujours un boolean, on priorise la valeur d'override si présente
    locked: extra?.locked ?? d.locked,
    // need est optionnel
    need: extra?.need,
  };
  return result;
}),
  items: ITEMS,
};

// 9) Aides de recherche
export function doorAt(x: number, y: number): Doorporte | null {
  return MAP.doors.find((d) => d.x === x && d.y === y) ?? null;
}
export function itemsAt(x: number, y: number): Item[] {
  return MAP.items.filter((i) => i.x === x && i.y === y);
}
