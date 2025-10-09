import {
  GRID,
  DOORS as IMPORTED_DOORS,
  WIDTH,
  HEIGHT,
  CELL,
  TILES,
} from "./generated_map_v3";

// ----------------------------- TYPES -----------------------------
export type KeyColor = "red" | "blue" | "green";
export type ItemKind = "vaccine" | "access-card" | "key-red" | "key-blue" | "key-green";
export type TileChar = typeof TILES[keyof typeof TILES];

export interface Room { name: string; x1: number; y1: number; x2: number; y2: number; }

export type PuzzleDef =
  | { type: "text"; question: string; answer: string; hint?: string }
  | { type: "mcq"; question: string; choices: string[]; correctIndex: number; hint?: string }
  | { type: "tf"; statement: string; correct: boolean; hint?: string };

export interface DoorMeta {
  x: number;
  y: number;
  locked: boolean;
  need?: KeyColor | "access";
  riddle?: PuzzleDef;
}

export interface MapData {
  width: number;
  height: number;
  grid: string[];
  rooms: Room[];
  doors: DoorMeta[];
  items: any[];
  cellSize: number;
}

// ----------------------------- HELPERS -----------------------------
export function isFloorLike(c: string | null): boolean {
  return c === TILES.FLOOR || c === TILES.DOOR;
}
export function charAt(x: number, y: number): string | null {
  if (y < 0 || y >= HEIGHT) return null;
  if (x < 0 || x >= WIDTH) return null;
  return GRID[y][x];
}

/* ----------------------------- ÉNIGMES CHIMIE + MÉDECINE (sans images) ----------------------------- */

// Texte libre
const TEXT_PUZZLES: PuzzleDef[] = [
  { type: "text", question: "Quel est le symbole chimique de l’eau ?", answer: "H2O" },
  { type: "text", question: "Quelle est la formule chimique du dioxyde de carbone ?", answer: "CO2" },
  { type: "text", question: "Quel organe produit l’insuline ?", answer: "pancréas" },
  { type: "text", question: "Comment s’appelle la plus petite unité de la matière ?", answer: "atome" },
  { type: "text", question: "Quel est le groupe sanguin universel donneur (notation complète) ?", answer: "O-" },
  { type: "text", question: "Quel est l’ion responsable du goût salé (formule) ?", answer: "NaCl" },
];

// QCM
const MCQ_PUZZLES: PuzzleDef[] = [
  { type: "mcq", question: "Quel organe filtre le sang ?", choices: ["Poumons", "Reins", "Cœur", "Foie"], correctIndex: 1 },
  { type: "mcq", question: "Le pH d’une solution neutre vaut :", choices: ["0", "7", "14"], correctIndex: 1 },
  { type: "mcq", question: "Les protéines sont composées principalement d’unités appelées :", choices: ["Acides aminés", "Nucléotides", "Monosaccharides"], correctIndex: 0 },
  { type: "mcq", question: "Quel est l’ion hydronium ?", choices: ["H+", "OH-", "H3O+"], correctIndex: 2 },
  { type: "mcq", question: "Quel organe stocke la bile ?", choices: ["Pancréas", "Vésicule biliaire", "Rate"], correctIndex: 1 },
];

// Vrai / Faux
const TF_PUZZLES: PuzzleDef[] = [
  { type: "tf", statement: "L’eau pure est un bon conducteur électrique.", correct: false },
  { type: "tf", statement: "Les antibiotiques n’agissent pas sur les virus.", correct: true },
  { type: "tf", statement: "L’ADN est présent dans le noyau des cellules eucaryotes.", correct: true },
  { type: "tf", statement: "Le dioxygène représente environ 78% de l’air.", correct: false }, // c'est l'azote ~78%
  { type: "tf", statement: "La digestion des lipides implique la bile.", correct: true },
];

// Mélange et attribution unique
function shuffle<T>(array: T[]): T[] {
  return array.map(a => [Math.random(), a] as [number, T])
              .sort((a, b) => a[0] - b[0])
              .map(a => a[1]);
}

const ALL_PUZZLES: PuzzleDef[] = shuffle([
  ...TEXT_PUZZLES,
  ...MCQ_PUZZLES,
  ...TF_PUZZLES,
]);

let nextPuzzleIndex = 0;
function getUniquePuzzle(): PuzzleDef {
  const puzzle = ALL_PUZZLES[nextPuzzleIndex];
  nextPuzzleIndex = (nextPuzzleIndex + 1) % ALL_PUZZLES.length;
  return puzzle;
}

/* ----------------------------- MAP ----------------------------- */
export const MAP: MapData = {
  width: WIDTH,
  height: HEIGHT,
  grid: GRID,
  cellSize: CELL,
  rooms: [],
  doors: IMPORTED_DOORS.map((d) => {
    const base: DoorMeta = { ...d };
    if (base.locked && base.need !== "access") {
      base.riddle = getUniquePuzzle();
    }
    return base;
  }),
  items: [],
};

export function doorAt(x: number, y: number): DoorMeta | null {
  return MAP.doors.find((d) => d.x === x && d.y === y) ?? null;
}
