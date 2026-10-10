const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const game = require("./server-game");

// Bind to every interface in hosted environments so the platform proxy can reach the server.
// Set HOST=127.0.0.1 locally when a loopback-only listener is preferred.
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;
const MAX_PLAYERS = 4;
const rooms = new Map();
const clients = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function makeRoomCode() {
  let code = "";
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const value = String(name || "").trim().replace(/\s+/g, " ");
  return value.slice(0, 12) || "玩家";
}

function send(client, message) {
  const ws = client?.ws || clients.get(client?.id)?.ws;
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function roomPlayers(room) {
  return [...room.players.values()].map((player, index) => ({
    id: player.id,
    name: player.name,
    seat: player.seat ?? index,
    ready: player.ready,
    host: player.id === room.hostId,
  }));
}

function roomSnapshot(room) {
  return {
    type: "room_update",
    room: room.code,
    hostId: room.hostId,
    started: room.started,
    playerCount: room.playerCount,
    players: roomPlayers(room),
  };
}

function broadcastRoom(room, message) {
  for (const player of room.players.values()) send(player, message);
}

function broadcastGame(room) {
  if (!room.game) return;
  for (const player of room.players.values()) {
    const localSeat = room.game.players.findIndex((item) => item.id === player.id);
    if (localSeat < 0) continue;
    send(player, {
      type: "game_state",
      room: room.code,
      localPlayerId: player.id,
      state: game.publicState(room.game, localSeat),
    });
  }
}

function leaveRoom(client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;
  const wasStarted = room.started;
  if (room.game) game.cancelTimers(room);
  if (wasStarted) {
    room.game = null;
    room.started = false;
  }
  room.players.delete(client.id);
  if (room.hostId === client.id) {
    room.hostId = room.players.keys().next().value || null;
    if (room.hostId) {
      const nextHost = room.players.get(room.hostId);
      if (nextHost) nextHost.ready = true;
    }
  }
  [...room.players.values()].forEach((player, index) => {
    player.seat = index;
  });
  if (!room.players.size) {
    rooms.delete(room.code);
    return;
  }
  broadcastRoom(room, roomSnapshot(room));
}

function joinRoom(client, room, name) {
  if (room.started) {
    send(client, { type: "error", message: "这间房已经开始游戏。" });
    return;
  }
  if (room.players.size >= Math.min(room.playerCount, MAX_PLAYERS)) {
    send(client, { type: "error", message: "房间已满。" });
    return;
  }
  leaveRoom(client);
  client.roomCode = room.code;
  client.name = cleanName(name);
  const usedSeats = new Set([...room.players.values()].map((player) => player.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat += 1;
  room.players.set(client.id, {
    id: client.id,
    name: client.name,
    ready: client.id === room.hostId,
    seat,
  });
  send(client, {
    type: "joined",
    room: room.code,
    playerId: client.id,
    hostId: room.hostId,
  });
  broadcastRoom(room, roomSnapshot(room));
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, { type: "error", message: "无法读取这条联机消息。" });
    return;
  }

  if (message.type === "create_room") {
    leaveRoom(client);
    const room = {
      code: makeRoomCode(),
      hostId: client.id,
      playerCount: Math.min(MAX_PLAYERS, Math.max(2, Number(message.playerCount) || 4)),
      started: false,
      seed: crypto.randomBytes(4).toString("hex"),
      players: new Map(),
      game: null,
      gameTimers: new Set(),
    };
    rooms.set(room.code, room);
    joinRoom(client, room, message.name);
    return;
  }

  if (message.type === "join_room") {
    const code = String(message.room || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      send(client, { type: "error", message: "没有找到这个房间。" });
      return;
    }
    joinRoom(client, room, message.name);
    return;
  }

  if (message.type === "leave_room") {
    leaveRoom(client);
    send(client, { type: "left_room" });
    return;
  }

  if (!client.roomCode) {
    send(client, { type: "error", message: "请先创建或加入房间。" });
    return;
  }

  const room = rooms.get(client.roomCode);
  const player = room?.players.get(client.id);
  if (!room || !player) {
    send(client, { type: "error", message: "房间连接已经失效，请重新加入。" });
    return;
  }

  if (message.type === "set_ready") {
    player.ready = Boolean(message.ready);
    broadcastRoom(room, roomSnapshot(room));
    return;
  }

  if (message.type === "start_game") {
    if (client.id !== room.hostId) {
      send(client, { type: "error", message: "只有房主可以开始游戏。" });
      return;
    }
    if (room.started) {
      send(client, { type: "error", message: "这间房的牌局已经开始。" });
      return;
    }
    if (room.players.size < 2) {
      send(client, { type: "error", message: "至少需要 2 名玩家。" });
      return;
    }
    if ([...room.players.values()].some((item) => !item.ready)) {
      send(client, { type: "error", message: "还有玩家没有准备。" });
      return;
    }
    room.started = true;
    room.game = game.startGame(roomPlayers(room));
    broadcastRoom(room, {
      type: "game_start",
      room: room.code,
      seed: room.seed,
      players: roomPlayers(room),
    });
    broadcastRoom(room, roomSnapshot(room));
    broadcastGame(room);
    return;
  }

  if (message.type === "game_action") {
    if (!room.started) {
      send(client, { type: "error", message: "游戏尚未开始。" });
      return;
    }
    const result = message.action === "continue_round"
      ? game.continueRound(room, client.id, broadcastGame)
      : game.applyAction(room, client.id, message.action, message.payload || null, broadcastGame);
    if (result?.error) send(client, { type: "error", message: result.error });
  }
}

function serveStatic(request, response) {
  const requested = decodeURIComponent((request.url || "/").split("?")[0]);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  serveStatic(request, response);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});

wss.on("connection", (ws) => {
  const client = { id: makeId(), name: "玩家", roomCode: null, ws };
  clients.set(client.id, client);
  send(client, { type: "hello", playerId: client.id, maxPlayers: MAX_PLAYERS });

  ws.on("message", (data) => handleMessage(client, data.toString()));
  ws.on("close", () => {
    leaveRoom(client);
    clients.delete(client.id);
  });
  ws.on("error", () => {
    leaveRoom(client);
    clients.delete(client.id);
  });
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Paper Safari online server listening on http://${displayHost}:${PORT}`);
});
