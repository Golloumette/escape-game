// Types partagés (aucune dépendance React ici)
export interface Player {
  id: string;      // utile pour le multi-joueur
  x: number;
  y: number;
  color?: string;  // couleur optionnelle pour l'affichage
}
