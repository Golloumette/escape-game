import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/** État minimal partagé (à adapter) */
const rooms = new Map(); // roomId -> { players: Map<pid,{x,y,color}>, doors: [], items: [] }

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, {
    players: new Map(),
    doors: [],  // option: précharger depuis ta map si tu veux côté serveur
    items: [],  // idem
  });
  return rooms.get(roomId);
}

io.on("connection", (socket) => {
  let roomId = null;
  let pid = null;

  socket.on("join", ({ room = "default", player }) => {
    roomId = room; pid = player.id;
    const state = ensureRoom(roomId);
    state.players.set(pid, { x: player.x, y: player.y, color: player.color });
    socket.join(roomId);

    // envoyer l'état courant au nouvel arrivant
    socket.emit("state:init", {
      players: Object.fromEntries(state.players),
      doors: state.doors,
      items: state.items,
    });

    // informer les autres
    socket.to(roomId).emit("player:join", { id: pid, ...state.players.get(pid) });
  });

  socket.on("player:move", ({ x, y }) => {
    if (!roomId || !pid) return;
    const state = rooms.get(roomId); if (!state) return;
    const p = state.players.get(pid); if (!p) return;
    p.x = x; p.y = y;
    socket.to(roomId).emit("player:update", { id: pid, x, y });
  });

  socket.on("door:open", ({ x, y }) => {
    if (!roomId) return;
    const state = rooms.get(roomId); if (!state) return;
    // ici tu peux mettre le serveur comme source de vérité (marquer la porte ouverte)
    // et rejeter si déjà ouverte ou si condition non remplie, etc.
    io.to(roomId).emit("door:opened", { x, y });
  });

  socket.on("item:pickup", ({ id }) => {
    if (!roomId) return;
    const state = rooms.get(roomId); if (!state) return;
    // supprime l'item côté serveur et broadcast
    state.items = state.items.filter(it => it.id !== id);
    io.to(roomId).emit("item:removed", { id });
  });

  socket.on("disconnect", () => {
    if (!roomId || !pid) return;
    const state = rooms.get(roomId); if (!state) return;
    state.players.delete(pid);
    socket.to(roomId).emit("player:leave", { id: pid });
  });
});
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Serveur back allumé", PORT));
