(function setupOnlineLobby() {
  const elements = {
    open: document.querySelector("#onlineButton"),
    close: document.querySelector("#onlineClose"),
    modal: document.querySelector("#onlineModal"),
    status: document.querySelector("#onlineStatus"),
    name: document.querySelector("#onlineName"),
    roomCodeInput: document.querySelector("#roomCodeInput"),
    create: document.querySelector("#createRoomButton"),
    join: document.querySelector("#joinRoomButton"),
    roomPanel: document.querySelector("#roomPanel"),
    roomCode: document.querySelector("#roomCodeLabel"),
    playerList: document.querySelector("#roomPlayerList"),
    ready: document.querySelector("#readyButton"),
    start: document.querySelector("#startOnlineButton"),
    invite: document.querySelector("#copyInviteButton"),
    leave: document.querySelector("#leaveRoomButton"),
  };

  const online = {
    socket: null,
    playerId: null,
    room: null,
    hostId: null,
    players: [],
    ready: false,
    started: false,
    gameState: null,
  };

  function setStatus(message, tone = "muted") {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }

  function openLobby() {
    elements.modal.classList.remove("hidden");
    connect();
  }

  function closeLobby() {
    elements.modal.classList.add("hidden");
  }

  function roomInviteUrl(room = online.room) {
    if (!room) return "";
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", room);
    return url.toString();
  }

  function updateRoomUrl(room) {
    const url = new URL(window.location.href);
    if (room) {
      url.search = "";
      url.hash = "";
      url.searchParams.set("room", room);
    } else {
      url.search = "";
      url.hash = "";
    }
    window.history.replaceState({}, "", url);
  }

  function send(message) {
    if (!online.socket || online.socket.readyState !== WebSocket.OPEN) {
      setStatus("联机服务尚未连接。", "error");
      return false;
    }
    online.socket.send(JSON.stringify(message));
    return true;
  }

  function connect() {
    if (online.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(online.socket.readyState)) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "127.0.0.1:4174";
    setStatus("正在连接联机服务…");
    try {
      online.socket = new WebSocket(`${protocol}//${host}/ws`);
    } catch {
      setStatus("无法创建联机连接，请使用联机服务器打开页面。", "error");
      return;
    }

    online.socket.addEventListener("open", () => setStatus("已连接，可以创建或加入房间。", "success"));
    online.socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(message);
    });
    online.socket.addEventListener("close", () => {
      online.room = null;
      online.players = [];
      online.started = false;
      online.gameState = null;
      window.PaperSafariApplyOnlineState?.(null);
      renderRoom();
      setStatus("联机连接已断开。", "error");
    });
    online.socket.addEventListener("error", () => setStatus("联机服务连接失败，请确认服务器已启动。", "error"));
  }

  function handleMessage(message) {
    if (message.type === "hello") {
      online.playerId = message.playerId;
      return;
    }
    if (message.type === "joined") {
      online.room = message.room;
      online.hostId = message.hostId;
      online.ready = false;
      updateRoomUrl(message.room);
      renderRoom();
      setStatus(`已加入房间 ${message.room}，等待其他玩家。`, "success");
      return;
    }
    if (message.type === "room_update") {
      online.room = message.room;
      online.hostId = message.hostId;
      online.players = message.players || [];
      online.started = Boolean(message.started);
      if (!online.started && online.gameState) {
        online.gameState = null;
        window.PaperSafariApplyOnlineState?.(null);
      }
      const self = online.players.find((player) => player.id === online.playerId);
      online.ready = Boolean(self?.ready);
      renderRoom();
      if (online.started) {
        setStatus("房间已开始，正在准备牌局同步…", "success");
      } else if (online.players.length) {
        setStatus(`房间 ${message.room} · ${online.players.length}/${message.playerCount} 人`, "success");
      }
      return;
    }
    if (message.type === "game_start") {
      online.started = true;
      setStatus("房间已开始，牌局同步模块已准备。", "success");
      closeLobby();
      return;
    }
    if (message.type === "game_state") {
      online.started = true;
      online.gameState = message.state || null;
      window.PaperSafariApplyOnlineState?.(online.gameState);
      closeLobby();
      return;
    }
    if (message.type === "left_room") {
      online.room = null;
      online.players = [];
      online.started = false;
      online.gameState = null;
      window.PaperSafariApplyOnlineState?.(null);
      updateRoomUrl("");
      renderRoom();
      setStatus("已离开房间。");
      return;
    }
    if (message.type === "error") {
      setStatus(message.message || "联机操作失败。", "error");
    }
  }

  function renderRoom() {
    const inRoom = Boolean(online.room);
    elements.roomPanel.classList.toggle("hidden", !inRoom);
    elements.roomCode.textContent = online.room || "------";
    elements.ready.textContent = online.ready ? "取消准备" : "准备";
    elements.start.disabled = !inRoom || online.hostId !== online.playerId || online.started;
    elements.ready.disabled = !inRoom || online.started;
    elements.invite.disabled = !inRoom;
    elements.leave.disabled = !inRoom;
    elements.playerList.innerHTML = online.players.length
      ? online.players.map((player) => `
          <div class="room-player ${player.id === online.playerId ? "self" : ""}">
            <span class="room-player-avatar">${player.name.slice(0, 1)}</span>
            <span class="room-player-name">${player.name}${player.id === online.playerId ? "（你）" : ""}</span>
            ${player.host ? '<span class="room-host">房主</span>' : ""}
            <span class="room-ready ${player.ready ? "is-ready" : ""}">${player.ready ? "已准备" : "未准备"}</span>
          </div>
        `).join("")
      : '<p class="room-empty">创建或加入一个房间后，玩家会显示在这里。</p>';
  }

  function playerName() {
    return elements.name.value.trim().slice(0, 12) || "玩家";
  }

  elements.open.addEventListener("click", openLobby);
  elements.close.addEventListener("click", closeLobby);
  elements.create.addEventListener("click", () => {
    const activeCount = document.querySelector("#playerCountControl button.active");
    send({
      type: "create_room",
      name: playerName(),
      playerCount: Number(activeCount?.dataset.playerCount || 4),
    });
  });
  elements.join.addEventListener("click", () => {
    send({
      type: "join_room",
      name: playerName(),
      room: elements.roomCodeInput.value.trim().toUpperCase(),
    });
  });
  elements.ready.addEventListener("click", () => send({ type: "set_ready", ready: !online.ready }));
  elements.start.addEventListener("click", () => send({ type: "start_game" }));
  elements.invite.addEventListener("click", async () => {
    const inviteUrl = roomInviteUrl();
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("邀请链接已复制，发给朋友即可加入。", "success");
    } catch {
      setStatus(`复制失败，请手动分享：${inviteUrl}`, "error");
    }
  });
  elements.leave.addEventListener("click", () => send({ type: "leave_room" }));
  elements.roomCodeInput.addEventListener("input", () => {
    elements.roomCodeInput.value = elements.roomCodeInput.value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  });

  const invitedRoom = new URL(window.location.href).searchParams.get("room");
  if (invitedRoom) {
    elements.roomCodeInput.value = invitedRoom.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
    openLobby();
  }

  window.PaperSafariOnline = {
    sendAction(action, payload) {
      return send({ type: "game_action", action, payload });
    },
    getSnapshot() {
      return {
        connected: Boolean(online.socket && online.socket.readyState === WebSocket.OPEN),
        playerId: online.playerId,
        room: online.room,
        hostId: online.hostId,
        players: online.players,
        started: online.started,
        gameState: online.gameState,
      };
    },
  };
})();
