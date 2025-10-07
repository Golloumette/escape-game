

// 1) On importe la grille et les constantes depuis le fichier auto-généré
import {
  GRID,
  DOORS as IMPORTED_DOORS,
  WIDTH,
  HEIGHT,
  CELL,
  TILES,           // { WALL:'#', FLOOR:'.', DOOR:'D', VOID:'"' }
} from "./generated_map_v3";

// 2) Types "jeu"
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

export interface DoorMeta {
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
  doors: DoorMeta[];
  items: Item[];
  cellSize: number;
}

// 3) Helpers lisibles
export function isVoid(c: string | null): boolean {
  return c === TILES.VOID; // symbole " pour le vide/transparent
}
export function isWall(c: string | null): boolean {
  return c === TILES.WALL;
}
export function isDoor(c: string | null): boolean {
  return c === TILES.DOOR;
}
export function isFloorLike(c: string | null): boolean {
  // sol ou porte (porte gérée ouverte/fermée côté logique)
  return c === TILES.FLOOR || c === TILES.DOOR;
}
export function isWalkable(c: string | null): boolean {
  // par défaut on considère "marchable" = sol ou porte (le blocage
  // d'une porte verrouillée est géré dans la logique du déplacement)
  return isFloorLike(c);
}

// 4) Fonctions utilitaires
export function charAt(x: number, y: number): string | null {
  if (y < 0 || y >= HEIGHT) return null;
  if (x < 0 || x >= WIDTH) return null;
  return GRID[y][x];
}

// 5) (Optionnel) Annoter certaines portes importées
//    L’import auto nous donne x,y,locked:true. On peut enrichir certaines
//    avec un besoin de clé/carte sans casser l’import.
const DOOR_REQUIREMENTS: Record<string, { need?: DoorMeta["need"]; locked?: boolean }> = {
  // Exemple (mets à jour selon TES coordonnées réelles) :
  // "7,1":  { need: "red",   locked: true },
  // "26,12":{ need: "access",locked: true },
};

// 6) Tes objets (⚠️ vérifie que les coordonnées correspondent à TA nouvelle grille)
export const ITEMS: Item[] = [
  // Exemple : ajuste ou vide si tu n’as pas encore placé d’objets
  // { id: "k-red",  kind: "key-red",     name: "Clé rouge",     x: 4,  y: 2  },
  // { id: "k-blue", kind: "key-blue",    name: "Clé bleue",     x: 12, y: 6  },
  // { id: "card-1", kind: "access-card", name: "Carte d'accès", x: 17, y: 10 },
  // { id: "vac-1",  kind: "vaccine",     name: "Vaccin",        x: 25, y: 2  },
];

// 7) Tes salles (idem : optionnel et à ajuster)
export const ROOMS: Room[] = [
  // { name: "Électricité", x1: 2,  y1: 1,  x2: 7,  y2: 3 },
  // { name: "Admin",       x1: 11, y1: 1,  x2: 20, y2: 3 },
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
    return extra ? { ...d, ...extra } : d;
  }),
  items: ITEMS,
};

// 9) Aides de recherche
export function doorAt(x: number, y: number): DoorMeta | null {
  return MAP.doors.find((d) => d.x === x && d.y === y) ?? null;
}
export function itemsAt(x: number, y: number): Item[] {
  return MAP.items.filter((i) => i.x === x && i.y === y);
}
