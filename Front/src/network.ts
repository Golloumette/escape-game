import { io, Socket } from "socket.io-client";
export type Net = Socket;

export function connectNet(url: string) {
  const socket = io(url, { transports: ["websocket"] });
  return socket;
}
