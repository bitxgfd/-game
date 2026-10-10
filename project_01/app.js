const TARGET_BADGES = 3;
const STEP_DELAY = 500;
const COIN_FLIP_DURATION = 900;

const CARD_DEFS = [
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `minus2-${copy}`, name: "普通牌 -2", value: -2, type: "普通", icon: "◒", color: "#d9e4bb" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `zero-${copy}`, name: "普通牌 0", value: 0, type: "普通", icon: "✦", color: "#d8e5c4" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `one-${copy}`, name: "普通牌 1", value: 1, type: "普通", icon: "◉", color: "#fae4ae" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `three-${copy}`, name: "普通牌 3", value: 3, type: "普通", icon: "◌", color: "#c9e3e6" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `four-${copy}`, name: "普通牌 4", value: 4, type: "普通", icon: "❋", color: "#d4e7ba" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `five-${copy}`, name: "普通牌 5", value: 5, type: "普通", icon: "ϟ", color: "#f6e29b" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `six-${copy}`, name: "普通牌 6", value: 6, type: "普通", icon: "◆", color: "#e2d4be" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `seven-${copy}`, name: "普通牌 7", value: 7, type: "普通", icon: "⌁", color: "#c6d8e5" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `eight-${copy}`, name: "普通牌 8", value: 8, type: "普通", icon: "☾", color: "#dcd0e7" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `nine-${copy}`, name: "普通牌 9", value: 9, type: "普通", icon: "✹", color: "#f2c4a9" })),
  ...Array.from({ length: 2 }, (_, copy) => ({ id: `snorlax-${copy}`, name: "卡比兽", value: 10, type: "卡比兽", icon: "●", color: "#b9d4da" })),
  ...Array.from({ length: 3 }, (_, copy) => ({ id: `zapdos-${copy}`, name: "闪电鸟", value: 10, type: "闪电鸟", icon: "ϟ", color: "#efd889" })),
  ...Array.from({ length: 3 }, (_, copy) => ({ id: `charizard-${copy}`, name: "喷火龙", value: 10, type: "喷火龙", icon: "◒", color: "#f1b38a" })),
  ...Array.from({ length: 2 }, (_, copy) => ({ id: `ditto-${copy}`, name: "百变怪", value: null, type: "百变怪", icon: "≈", color: "#c7b8de" })),
  ...Array.from({ length: 2 }, (_, copy) => ({ id: `mew-${copy}`, name: "梦幻", value: 2, type: "梦幻", icon: "⌁", color: "#ecc5d4" })),
  ...Array.from({ length: 4 }, (_, copy) => ({ id: `rocket-${copy}`, name: "火箭队", value: 12, type: "火箭队", icon: "R", color: "#c9cbd3" })),
];

const state = {
  round: 1,
  playerCount: 4,
  currentPlayer: 0,
  roundStarter: 0,
  drawPile: [],
  discardPile: [],
  drawnCard: null,
  drawnSource: null,
  players: [],
  logs: [],
  phase: "draw",
  selectedCardIndex: null,
  rocketHeads: null,
  pendingMew: null,
  pendingSwap: null,
  pendingDittoChoices: [],
  roundLocked: false,
  busy: false,
  coinAnimating: false,
  actionToken: 0,
};

let onlineMode = false;
let onlineLocalSeat = null;
let onlineResultKey = null;

const elements = {
  scoreList: document.querySelector("#scoreList"),
  opponentsRow: document.querySelector("#opponentsRow"),
  playerGrid: document.querySelector("#playerGrid"),
  drawnCard: document.querySelector("#drawnCard"),
  discardPreview: document.querySelector("#discardPreview"),
  drawDeckCount: document.querySelector("#drawDeckCount"),
  discardDeckCount: document.querySelector("#discardDeckCount"),
  deckCount: document.querySelector("#deckCount"),
  statusText: document.querySelector("#statusText"),
  playerScore: document.querySelector("#playerScore"),
  playerHint: document.querySelector("#playerHint"),
  logList: document.querySelector("#logList"),
  roundLabel: document.querySelector("#roundLabel"),
  turnChip: document.querySelector("#turnChip"),
  rulesModal: document.querySelector("#rulesModal"),
  messageModal: document.querySelector("#messageModal"),
  resultEyebrow: document.querySelector("#resultEyebrow"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCopy: document.querySelector("#resultCopy"),
  discardDrawnButton: document.querySelector("#discardDrawnButton"),
  newGameButton: document.querySelector("#newGameButton"),
  playerCountControl: document.querySelector("#playerCountControl"),
  rocketCoin: document.querySelector("#rocketCoin"),
  coinLabel: document.querySelector("#coinLabel"),
};

const namePool = ["你", "芽衣", "小洛", "阿岚"];
const avatarClasses = ["avatar-you", "avatar-ai-1", "avatar-ai-2", "avatar-ai-3"];

function cloneCard(card) {
  return { ...card, faceUp: false, dittoValue: null, dittoTargetIndex: null };
}

function shuffle(list) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function addLog(message, accent = "normal") {
  state.logs.unshift({ message, accent });
  state.logs = state.logs.slice(0, 7);
  renderLogs();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function beginTimedAction() {
  state.actionToken += 1;
  state.busy = true;
  return state.actionToken;
}

function isActionActive(token) {
  return token === state.actionToken;
}

function sendOnlineAction(action, payload = null) {
  return window.PaperSafariOnline?.sendAction(action, payload);
}

function applyOnlineState(snapshot) {
  if (!snapshot) {
    const wasOnline = onlineMode;
    onlineMode = false;
    onlineLocalSeat = null;
    onlineResultKey = null;
    elements.playerCountControl.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
    document.querySelector("#continueButton").disabled = false;
    if (wasOnline) startFreshGame();
    return;
  }

  onlineMode = true;
  onlineLocalSeat = Number(snapshot.localSeat);
  const serverPlayers = Array.isArray(snapshot.players) ? snapshot.players : [];
  const order = [
    onlineLocalSeat,
    ...serverPlayers.map((player) => player.seat).filter((seat) => seat !== onlineLocalSeat),
  ];
  const bySeat = new Map(serverPlayers.map((player) => [player.seat, player]));
  state.round = snapshot.round;
  state.playerCount = snapshot.playerCount || serverPlayers.length;
  state.roundStarter = order.indexOf(snapshot.roundStarter);
  state.currentPlayer = order.indexOf(snapshot.currentPlayer);
  state.drawPile = snapshot.drawPile || [];
  state.discardPile = snapshot.discardPile || [];
  state.drawnCard = snapshot.drawnCard || null;
  state.drawnSource = snapshot.drawnSource || null;
  state.players = order.map((seat) => ({ ...(bySeat.get(seat) || {}), seat }));
  state.logs = snapshot.logs || [];
  state.phase = snapshot.phase || "draw";
  state.selectedCardIndex = snapshot.selectedCardIndex ?? null;
  state.rocketHeads = snapshot.rocketHeads ?? null;
  state.pendingMew = snapshot.pendingMew
    ? {
      ...snapshot.pendingMew,
      ownIndex: snapshot.pendingMew.ownCardIndex ?? null,
      outgoingCard: null,
    }
    : null;
  state.pendingSwap = snapshot.pendingSwap || null;
  state.pendingDittoChoices = snapshot.pendingDittoChoices || [];
  state.roundLocked = Boolean(snapshot.roundLocked);
  state.busy = Boolean(snapshot.busy);
  state.coinAnimating = Boolean(snapshot.coinAnimating);
  state.actionToken += 1;
  elements.playerCountControl.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
  if (snapshot.roundResult) {
    const resultKey = `${snapshot.round}-${snapshot.roundResult.winners.map((winner) => winner.id).join(",")}`;
    if (onlineResultKey !== resultKey) {
      onlineResultKey = resultKey;
      showOnlineResult(snapshot.roundResult);
    }
  } else {
    onlineResultKey = null;
    closeModal(elements.messageModal);
  }
  renderAll();
}

function showOnlineResult(result) {
  const winners = result.winners || [];
  const gameWinners = result.gameWinners || [];
  const completed = gameWinners.length > 0;
  const winnerNames = winners.map((winner) => winner.name).join("、");
  const gameWinnerNames = gameWinners.map((winner) => winner.name).join("、");
  elements.resultEyebrow.textContent = completed ? "GAME COMPLETE" : "ROUND COMPLETE";
  elements.resultTitle.textContent = completed ? `${gameWinnerNames}赢得整场比赛` : winners.length > 1 ? "最低分并列" : "本轮结算";
  elements.resultCopy.textContent = `${winners.length > 1 ? "最低分并列为" : "最低分"} ${result.lowest} 分，${winnerNames}各获得 1 枚徽章。${completed ? `恭喜${gameWinnerNames}成为宝可梦大师！` : "下一轮将由房主开始。"} `;
  const continueButton = document.querySelector("#continueButton");
  const onlineSnapshot = window.PaperSafariOnline?.getSnapshot?.();
  const isOnlineHost = !onlineMode || onlineSnapshot?.hostId === onlineSnapshot?.playerId;
  continueButton.textContent = isOnlineHost ? (completed ? "重新开始" : "开始下一轮") : "等待房主继续";
  continueButton.disabled = !isOnlineHost;
  openModal(elements.messageModal);
}

window.PaperSafariApplyOnlineState = applyOnlineState;

function newRound(isFreshGame = false) {
  if (onlineMode) return;
  state.actionToken += 1;
  state.busy = false;
  state.coinAnimating = false;
  state.drawPile = shuffle(CARD_DEFS.map(cloneCard));
  const openingDiscard = state.drawPile.pop();
  openingDiscard.faceUp = true;
  state.discardPile = [openingDiscard];
  state.drawnCard = null;
  state.drawnSource = null;
  state.phase = "draw";
  state.selectedCardIndex = null;
  state.rocketHeads = null;
  state.pendingMew = null;
  state.pendingSwap = null;
  state.pendingDittoChoices = [];
  state.currentPlayer = isFreshGame ? 0 : state.roundStarter % state.playerCount;
  state.roundLocked = false;
  state.players = state.players.length
    ? state.players.slice(0, state.playerCount).map((player) => ({ ...player, cards: dealCards(), score: null }))
    : Array.from({ length: state.playerCount }, (_, index) => ({
      name: namePool[index],
      badges: 0,
      cards: dealCards(),
      score: null,
    }));

  for (const player of state.players) {
    player.cards[4].faceUp = true;
  }

  addLog(isFreshGame ? "新的一局开始，先从起始玩家行动。" : "上一轮冠军重新成为起始玩家。", "accent");
  updateStatus();
  renderAll();
  if (!isFreshGame && state.currentPlayer !== 0) runAiTurns();
}

function dealCards() {
  return Array.from({ length: 6 }, () => state.drawPile.pop());
}

function startFreshGame() {
  if (onlineMode) return;
  state.round = 1;
  state.roundStarter = 0;
  state.players = [];
  state.logs = [];
  newRound(true);
  closeModal(elements.messageModal);
}

function getCardValue(card, playerCards = [], index = -1, visiting = new Set()) {
  if (!card) return 0;
  if (card.type !== "百变怪") return Number.isFinite(card.value) ? card.value : 0;
  if (Number.isFinite(card.dittoValue)) return card.dittoValue;
  if (
    visiting.has(index)
    || !Number.isInteger(card.dittoTargetIndex)
    || !playerCards[card.dittoTargetIndex]
  ) return 0;
  const next = new Set(visiting);
  next.add(index);
  return getCardValue(playerCards[card.dittoTargetIndex], playerCards, card.dittoTargetIndex, next);
}

function calculateScore(player) {
  const cards = player.cards;
  const values = cards.map((card, index) => {
    const value = getCardValue(card, cards, index);
    return Number.isFinite(value) ? value : 0;
  });
  let score = 0;
  for (let col = 0; col < 3; col += 1) {
    const topIndex = col;
    const bottomIndex = col + 3;
    if (values[topIndex] === values[bottomIndex]) {
      continue;
    }
    score += values[topIndex] + values[bottomIndex];
  }
  return score;
}

async function drawFrom(source) {
  if (onlineMode) {
    if (state.currentPlayer !== 0 || state.busy || state.phase !== "draw") return;
    sendOnlineAction(source === "draw" ? "draw_deck" : "draw_discard");
    return;
  }
  if (state.roundLocked || state.busy || state.phase !== "draw" || state.currentPlayer !== 0) return;
  if (source === "draw" && state.drawPile.length === 0) recycleDiscard();
  if (source === "discard" && state.discardPile.length === 0) return;
  if (source === "draw" && state.drawPile.length === 0) return;
  const token = beginTimedAction();
  state.drawnSource = source;
  state.drawnCard = source === "draw" ? state.drawPile.pop() : state.discardPile.pop();
  state.drawnCard.faceUp = true;
  state.phase = "resolve";
  state.selectedCardIndex = null;
  addLog(`${source === "draw" ? "你从摸牌堆抽到" : "你拿起弃牌堆顶"}：${state.drawnCard.name}。`, "accent");
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  if (state.drawnCard.type === "火箭队") {
    await resolveRocket(token);
    return;
  }
  if (state.drawnCard.type === "梦幻") {
    state.pendingMew = { ownIndex: null, outgoingCard: null, targetPlayer: null };
    state.phase = "mew-own";
    addLog("梦幻发动：请先选择自己的一个卡位。", "accent");
  }
  state.busy = false;
  renderAll();
}

function recycleDiscard(protectedIds = new Set()) {
  if (state.discardPile.length <= 1) return;
  const topIndex = state.discardPile.length - 1;
  const recyclable = state.discardPile.filter((card, index) => (
    index !== topIndex && !protectedIds.has(card.id)
  ));
  if (!recyclable.length) return;
  state.drawPile = shuffle(recyclable);
  state.discardPile = state.discardPile.filter((card, index) => (
    index === topIndex || protectedIds.has(card.id)
  ));
  addLog("摸牌堆耗尽，弃牌重新洗入摸牌堆。");
}

function drawRefillCard(protectedIds = new Set()) {
  if (state.drawPile.length === 0) recycleDiscard(protectedIds);
  return state.drawPile.pop() || null;
}

function discardToBottom(cards) {
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index];
    if (!card) continue;
    state.discardPile.unshift({ ...card, faceUp: true });
  }
}

function replacePlayerCard(playerIndex, cardIndex, incomingCard) {
  const player = state.players[playerIndex];
  const outgoing = player.cards[cardIndex];
  outgoing.faceUp = true;
  state.discardPile.push(outgoing);
  incomingCard.faceUp = true;
  player.cards[cardIndex] = incomingCard;
  return outgoing;
}

async function executeZapdos(position, token) {
  const bird = state.drawnCard;
  const firstPlayer = 0;
  const incoming = state.drawnCard;
  const replaced = [];
  let passCard = state.players[firstPlayer].cards[position];
  state.players[firstPlayer].cards[position] = { ...bird, faceUp: true };
  replaced.push(passCard.name);
  for (let playerIndex = 1; playerIndex < state.playerCount; playerIndex += 1) {
    const outgoing = state.players[playerIndex].cards[position];
    state.players[playerIndex].cards[position] = { ...passCard, faceUp: true };
    passCard = outgoing;
    replaced.push(outgoing.name);
  }
  state.discardPile.unshift({ ...passCard, faceUp: true });
  addLog(`闪电鸟完成传递：${replaced.join(" → ")}。`);
  renderAll();
  await wait(STEP_DELAY);
  if (isActionActive(token)) await finishHumanResolve(token);
}

async function resolveRocket(token) {
  state.phase = "rocket-flip";
  state.rocketHeads = null;
  state.coinAnimating = true;
  addLog("火箭队：硬币投掷中。", "accent");
  renderAll();
  await wait(COIN_FLIP_DURATION);
  if (!isActionActive(token)) return;
  const heads = Math.random() < 0.5;
  state.coinAnimating = false;
  state.rocketHeads = heads;
  addLog(`火箭队硬币：${heads ? "正面" : "反面"}。`, "accent");
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  state.phase = heads ? "rocket-choose" : "resolve";
  state.busy = false;
  renderAll();
}

async function selectPlayerCard(index) {
  if (onlineMode) {
    if (state.busy || state.roundLocked || state.currentPlayer !== 0) return;
    if (state.phase === "ditto-choice") {
      sendOnlineAction("select_ditto", { index });
    } else {
      sendOnlineAction("select_card", { index });
    }
    return;
  }
  if (state.busy) return;
  if (state.phase === "ditto-choice") {
    await chooseDittoTarget(index);
    return;
  }
  if (state.roundLocked || state.currentPlayer !== 0) return;
  if (state.phase === "snorlax-first" && state.pendingSwap) {
    const token = beginTimedAction();
    state.pendingSwap.first = index;
    state.phase = "snorlax-second";
    addLog(`卡比兽：已选择第 ${index + 1} 个卡位，请再选择任意另一张牌。`, "accent");
    renderAll();
    await wait(STEP_DELAY);
    if (isActionActive(token)) {
      state.busy = false;
      renderAll();
    }
    return;
  }
  if (state.phase === "snorlax-second" && state.pendingSwap) {
    if (state.pendingSwap.first === index) return;
    const token = beginTimedAction();
    const first = state.pendingSwap.first;
    state.selectedCardIndex = index;
    renderAll();
    await wait(STEP_DELAY);
    if (!isActionActive(token)) return;
    [state.players[0].cards[first], state.players[0].cards[index]] = [state.players[0].cards[index], state.players[0].cards[first]];
    addLog(`卡比兽效果：你交换了第 ${first + 1} 和第 ${index + 1} 个卡位。`);
    state.pendingSwap = null;
    await finishHumanResolve(token);
    return;
  }
  if (state.phase === "mew-own" && state.pendingMew) {
    const token = beginTimedAction();
    const ownCard = state.players[0].cards[index];
    if (!ownCard || !state.drawnCard) {
      state.busy = false;
      return;
    }
    state.players[0].cards[index] = { ...state.drawnCard, faceUp: true };
    state.pendingMew.ownIndex = index;
    state.pendingMew.outgoingCard = { ...ownCard };
    state.drawnCard = null;
    state.drawnSource = null;
    state.phase = "mew-target";
    addLog(`梦幻：请选择一名对手，将第 ${index + 1} 个卡位的牌交给他。`, "accent");
    renderAll();
    await wait(STEP_DELAY);
    if (isActionActive(token)) {
      state.busy = false;
      renderAll();
    }
    return;
  }
  if (state.phase === "charizard-peek") {
    const token = beginTimedAction();
    const card = state.players[0].cards[index];
    if (card.faceUp) {
      state.busy = false;
      return;
    }
    card.faceUp = true;
    addLog(`喷火龙让你查看了第 ${index + 1} 个卡位。`, "accent");
    renderAll();
    await wait(1100);
    if (!isActionActive(token)) return;
    card.faceUp = false;
    renderAll();
    await finishHumanResolve(token);
    return;
  }
  if (state.phase === "rocket-choose" && state.drawnCard?.type === "火箭队") {
    const token = beginTimedAction();
    await resolveRocketHeads(index, token);
    return;
  }
  if (state.phase !== "resolve" || !state.drawnCard) return;
  const incoming = state.drawnCard;
  if (incoming.type === "梦幻") {
    return;
  }
  if (incoming.type === "闪电鸟") {
    const token = beginTimedAction();
    state.selectedCardIndex = index;
    renderAll();
    await wait(STEP_DELAY);
    if (isActionActive(token)) await executeZapdos(index, token);
    return;
  }
  if (incoming.type === "火箭队" && state.rocketHeads) {
    const token = beginTimedAction();
    await resolveRocketHeads(index, token);
    return;
  }
  const token = beginTimedAction();
  state.selectedCardIndex = index;
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  const outgoing = replacePlayerCard(0, index, incoming);
  state.drawnCard = null;
  state.selectedCardIndex = null;
  addLog(`你用 ${incoming.name} 替换了自己的第 ${index + 1} 个卡位。`);
  if (incoming.type === "卡比兽") {
    state.pendingSwap = { first: null };
    state.phase = "snorlax-first";
    addLog("卡比兽效果：请选择任意一张牌作为交换起点。", "accent");
    renderAll();
    await wait(STEP_DELAY);
    if (isActionActive(token)) {
      state.busy = false;
      renderAll();
    }
    return;
  } else if (incoming.type === "喷火龙") {
    const hasHiddenCard = state.players[0].cards.some((card) => !card.faceUp);
    if (hasHiddenCard) {
      state.phase = "charizard-peek";
      addLog("喷火龙效果：选择一张背面牌查看。", "accent");
      renderAll();
      await wait(STEP_DELAY);
      if (isActionActive(token)) {
        state.busy = false;
        renderAll();
      }
      return;
    }
  } else if (incoming.type === "百变怪") {
    addLog("百变怪会在结算时复制相邻卡牌分值。");
  } else if (incoming.type === "火箭队" && !state.rocketHeads) {
    addLog("火箭队反面：火箭队替换了一个卡位。");
  }
  await finishHumanResolve(token);
}

async function selectOpponentCard(playerIndex, cardIndex) {
  if (onlineMode) {
    if (state.busy || state.roundLocked || state.currentPlayer !== 0 || state.phase !== "mew-target") return;
    const targetPlayer = state.players[playerIndex]?.seat;
    if (targetPlayer === undefined) return;
    sendOnlineAction("select_mew_target", { playerIndex: targetPlayer });
    return;
  }
  if (state.busy || state.roundLocked || state.currentPlayer !== 0 || state.phase !== "mew-target" || !state.pendingMew) return;
  const token = beginTimedAction();
  state.pendingMew.targetPlayer = playerIndex;
  addLog(`梦幻：将第 ${state.pendingMew.ownIndex + 1} 个卡位的牌交给${state.players[playerIndex].name}。`, "accent");
  renderAll();
  await wait(STEP_DELAY);
  if (isActionActive(token)) {
    resolveMew(token);
  }
}

async function resolveMew(token) {
  const targetPlayer = state.pendingMew.targetPlayer;
  const position = state.pendingMew.ownIndex;
  const ownCard = state.pendingMew.outgoingCard;
  const targetCard = state.players[targetPlayer].cards[position];
  state.players[targetPlayer].cards[position] = { ...ownCard, faceUp: ownCard.faceUp };
  state.discardPile.push({ ...targetCard, faceUp: true });
  state.drawnSource = null;
  state.pendingMew = null;
  addLog(`梦幻效果：你将第 ${position + 1} 个卡位的替换牌交给了${state.players[targetPlayer].name}，对方原牌已弃掉。`, "accent");
  renderAll();
  await wait(STEP_DELAY);
  if (isActionActive(token)) await finishHumanResolve(token);
}

async function resolveRocketHeads(position, token) {
  const rocket = state.drawnCard;
  const discarded = [
    rocket,
    ...state.players.map((player) => player.cards[position]),
  ].filter(Boolean);
  discardToBottom(discarded);
  const protectedIds = new Set(discarded.map((card) => card.id));
  for (let offset = 0; offset < state.playerCount; offset += 1) {
    const playerIndex = (offset + 0) % state.playerCount;
    const refill = drawRefillCard(protectedIds);
    state.players[playerIndex].cards[position] = refill ? { ...refill, faceUp: false } : cloneCard(CARD_DEFS[0]);
  }
  addLog(`火箭队正面：所有玩家弃掉第 ${position + 1} 个卡位并从你开始补牌，弃牌置于牌堆底部。`, "accent");
  renderAll();
  await wait(STEP_DELAY);
  if (isActionActive(token)) await finishHumanResolve(token);
}

async function finishHumanResolve(token = state.actionToken) {
  state.drawnCard = null;
  state.drawnSource = null;
  state.selectedCardIndex = null;
  state.pendingMew = null;
  state.pendingSwap = null;
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  state.busy = false;
  finishPlayerTurn(0);
}

async function discardDrawnCard() {
  if (onlineMode) {
    if (state.busy || state.currentPlayer !== 0) return;
    sendOnlineAction("discard_drawn");
    return;
  }
  if (state.busy || !state.drawnCard || state.drawnSource !== "draw" || state.phase !== "resolve" || state.drawnCard.type !== "普通") return;
  const token = beginTimedAction();
  state.discardPile.push({ ...state.drawnCard, faceUp: true });
  addLog(`你将 ${state.drawnCard.name} 放入了弃牌堆。`);
  renderAll();
  await finishHumanResolve(token);
}

function finishPlayerTurn(playerIndex) {
  if (checkRoundEnd(playerIndex)) return;
  state.currentPlayer = (playerIndex + 1) % state.playerCount;
  state.phase = state.currentPlayer === 0 ? "draw" : "ai";
  renderAll();
  if (state.currentPlayer !== 0) runAiTurns();
}

async function runAiTurns() {
  if (state.roundLocked || state.currentPlayer === 0) return;
  const token = beginTimedAction();
  state.phase = "ai";
  renderAll();
  const playerIndex = state.currentPlayer;
  await wait(STEP_DELAY);
  if (!isActionActive(token) || state.roundLocked || state.currentPlayer !== playerIndex) return;
  await aiTakeTurn(playerIndex, token);
  if (!isActionActive(token) || state.roundLocked || state.currentPlayer !== playerIndex) return;
  state.drawnCard = null;
  state.drawnSource = null;
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token) || state.roundLocked || state.currentPlayer !== playerIndex) return;
  state.busy = false;
  finishPlayerTurn(playerIndex);
}

function chooseWorstCardIndex(player) {
  const values = player.cards.map((card, index) => getCardValue(card, player.cards, index));
  return values.indexOf(Math.max(...values));
}

function executeZapdosFor(playerIndex, position, bird) {
  let passCard = state.players[playerIndex].cards[position];
  state.players[playerIndex].cards[position] = { ...bird, faceUp: true };
  for (let offset = 1; offset < state.playerCount; offset += 1) {
    const receiverIndex = (playerIndex + offset) % state.playerCount;
    const outgoing = state.players[receiverIndex].cards[position];
    state.players[receiverIndex].cards[position] = { ...passCard, faceUp: true };
    passCard = outgoing;
  }
  state.discardPile.unshift({ ...passCard, faceUp: true });
  addLog(`${state.players[playerIndex].name}发动闪电鸟，卡牌顺时针传递。`);
}

function executeRocketFor(playerIndex, position, rocket) {
  const discarded = [
    rocket,
    ...state.players.map((player) => player.cards[position]),
  ].filter(Boolean);
  discardToBottom(discarded);
  const protectedIds = new Set(discarded.map((card) => card.id));
  for (let offset = 0; offset < state.playerCount; offset += 1) {
    const refillIndex = (playerIndex + offset) % state.playerCount;
    const refill = drawRefillCard(protectedIds);
    state.players[refillIndex].cards[position] = refill ? { ...refill, faceUp: false } : cloneCard(CARD_DEFS[0]);
  }
  addLog(`${state.players[playerIndex].name}掷出正面，所有玩家弃掉同一位置的牌并从该玩家开始补牌，弃牌置底。`);
}

async function aiTakeTurn(playerIndex, token) {
  if (state.drawPile.length === 0) recycleDiscard();
  const takeDiscard = state.discardPile.length > 0 && Math.random() > 0.55;
  const card = takeDiscard ? state.discardPile.pop() : state.drawPile.pop();
  if (!card) return;
  card.faceUp = true;
  const player = state.players[playerIndex];
  const targetIndex = chooseWorstCardIndex(player);
  state.drawnSource = takeDiscard ? "discard" : "draw";
  state.drawnCard = card;
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  if (!takeDiscard && card.type === "普通" && card.value >= getCardValue(player.cards[targetIndex], player.cards, targetIndex)) {
    state.discardPile.push(card);
    addLog(`${player.name}抽到${card.name}后选择弃掉。`);
    renderAll();
    await wait(STEP_DELAY);
    return;
  }
  if (card.type === "火箭队") {
    const heads = Math.random() < 0.5;
    state.phase = "rocket-flip";
    state.rocketHeads = null;
    state.coinAnimating = true;
    addLog(`${player.name}：硬币投掷中。`, "accent");
    renderAll();
    await wait(COIN_FLIP_DURATION);
    if (!isActionActive(token)) return;
    state.coinAnimating = false;
    state.rocketHeads = heads;
    addLog(`${player.name}掷火箭队硬币：${heads ? "正面" : "反面"}。`);
    renderAll();
    await wait(STEP_DELAY);
    if (!isActionActive(token)) return;
    if (heads) {
      executeRocketFor(playerIndex, targetIndex, card);
      state.phase = "ai";
      renderAll();
      await wait(STEP_DELAY);
      return;
    }
    addLog(`${player.name}掷出反面，用火箭队替换一个卡位。`);
    state.phase = "ai";
  }
  if (card.type === "闪电鸟") {
    executeZapdosFor(playerIndex, targetIndex, card);
    renderAll();
    await wait(STEP_DELAY);
    return;
  }
  if (card.type === "梦幻") {
    const otherPlayers = state.players.map((_, index) => index).filter((index) => index !== playerIndex);
    const targetPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    const targetCardIndex = Math.floor(Math.random() * 6);
    const targetCard = state.players[targetPlayer].cards[targetCardIndex];
    const outgoing = player.cards[targetIndex];
    state.players[targetPlayer].cards[targetCardIndex] = { ...card, faceUp: true };
    player.cards[targetIndex] = { ...targetCard, faceUp: outgoing.faceUp };
    state.discardPile.push({ ...outgoing, faceUp: true });
    addLog(`${player.name}用梦幻交换了两名玩家的卡牌。`);
    renderAll();
    await wait(STEP_DELAY);
    return;
  }
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  replacePlayerCard(playerIndex, targetIndex, card);
  addLog(`${player.name}替换了一个卡位。`);
  if (card.type === "卡比兽") {
    const second = (targetIndex + 3) % 6;
    [player.cards[targetIndex], player.cards[second]] = [player.cards[second], player.cards[targetIndex]];
    addLog(`${player.name}发动卡比兽，交换了两张牌的位置。`);
  } else if (card.type === "喷火龙" && player.cards.some((item) => !item.faceUp)) {
    addLog(`${player.name}用喷火龙查看了一张背面牌。`);
  }
  renderAll();
  await wait(STEP_DELAY);
}

function checkRoundEnd(playerIndex) {
  if (!state.players[playerIndex]?.cards.every((card) => card.faceUp)) return false;
  state.roundLocked = true;
  state.players.forEach((player) => player.cards.forEach((card) => { card.faceUp = true; }));
  state.pendingDittoChoices = [];
  state.players.forEach((player, ownerIndex) => player.cards.forEach((card, cardIndex) => {
    if (
      card.type !== "百变怪"
      || Number.isFinite(card.dittoValue)
      || Number.isInteger(card.dittoTargetIndex)
    ) return;
    const column = cardIndex % 3;
    const neighbours = [];
    if (column > 0) neighbours.push(cardIndex - 1);
    if (column < 2) neighbours.push(cardIndex + 1);
    if (neighbours.length === 1) {
      card.dittoTargetIndex = neighbours[0];
    } else if (ownerIndex === 0) {
      state.pendingDittoChoices.push({ cardIndex });
    } else {
      const leftValue = getCardValue(player.cards[neighbours[0]], player.cards, neighbours[0]);
      const rightValue = getCardValue(player.cards[neighbours[1]], player.cards, neighbours[1]);
      card.dittoTargetIndex = leftValue <= rightValue ? neighbours[0] : neighbours[1];
    }
  }));
  if (state.pendingDittoChoices.length) {
    state.currentPlayer = 0;
    state.phase = "ditto-choice";
    renderAll();
    return true;
  }
  finalizeRound();
  return true;
}

async function chooseDittoTarget(index) {
  if (state.busy) return;
  const pending = state.pendingDittoChoices[0];
  if (!pending) return;
  const row = Math.floor(pending.cardIndex / 3);
  const dittoColumn = pending.cardIndex % 3;
  if (Math.floor(index / 3) !== row || Math.abs(index % 3 - dittoColumn) !== 1) return;
  const token = beginTimedAction();
  state.selectedCardIndex = index;
  renderAll();
  await wait(STEP_DELAY);
  if (!isActionActive(token)) return;
  state.players[0].cards[pending.cardIndex].dittoTargetIndex = index;
  state.pendingDittoChoices.shift();
  if (state.pendingDittoChoices.length) {
    state.selectedCardIndex = null;
    state.busy = false;
    renderAll();
    return;
  }
  state.selectedCardIndex = null;
  state.busy = false;
  finalizeRound();
}

function finalizeRound() {
  state.players.forEach((player) => {
    const score = calculateScore(player);
    player.score = Number.isFinite(score) ? score : 0;
  });
  const lowest = Math.min(...state.players.map((player) => player.score));
  const winners = state.players.filter((player) => player.score === lowest);
  winners.forEach((player) => { player.badges += 1; });
  state.roundStarter = state.players.indexOf(winners[0]);
  renderAll();
  const winnerNames = winners.map((player) => player.name).join("、");
  const gameWinners = winners.filter((player) => player.badges >= TARGET_BADGES);
  const gameWinner = gameWinners.length > 0;
  const gameWinnerNames = gameWinners.map((player) => player.name).join("、");
  elements.resultEyebrow.textContent = gameWinner ? "GAME COMPLETE" : "ROUND COMPLETE";
  elements.resultTitle.textContent = gameWinner ? `${gameWinnerNames}赢得整场比赛` : winners.length > 1 ? "最低分并列" : "本轮结算";
  elements.resultCopy.textContent = `${winners.length > 1 ? "最低分并列为" : "最低分"} ${lowest} 分，${winnerNames}各获得 1 枚徽章。${gameWinner ? `恭喜${gameWinnerNames}成为宝可梦大师！` : "下一轮将由本轮冠军起始。"} `;
  document.querySelector("#continueButton").textContent = gameWinner ? "重新开始" : "开始下一轮";
  document.querySelector("#continueButton").disabled = false;
  openModal(elements.messageModal);
}

function continueGame() {
  if (onlineMode) {
    sendOnlineAction("continue_round");
    return;
  }
  const hasWinner = state.players.some((player) => player.badges >= TARGET_BADGES);
  if (hasWinner) {
    startFreshGame();
    return;
  }
  state.round += 1;
  newRound(false);
  closeModal(elements.messageModal);
}

function updateStatus() {
  const active = state.players[state.currentPlayer];
  const isHuman = state.currentPlayer === 0;
  elements.roundLabel.textContent = state.round;
  elements.turnChip.textContent = isHuman ? "你的回合" : `${active?.name || "对手"}行动中`;
  if (state.phase === "rocket-flip") {
    elements.statusText.textContent = state.coinAnimating ? "火箭队：硬币投掷中…" : "火箭队：请查看硬币结果";
  } else if (state.phase === "draw") {
    elements.statusText.textContent = isHuman ? "请选择摸牌堆或弃牌堆" : `${active?.name || "对手"}正在思考`;
  } else if (state.phase === "resolve") {
    elements.statusText.textContent = state.drawnCard?.type === "火箭队"
      ? "火箭队反面：请选择一个卡位替换"
      : "请选择一个卡位完成替换";
  } else if (state.phase === "mew-target") {
    elements.statusText.textContent = `梦幻：选择一名对手，接收你第 ${(state.pendingMew?.ownIndex ?? 0) + 1} 个位置换下的牌`;
  } else if (state.phase === "mew-own") {
    elements.statusText.textContent = "梦幻：先选择自己的卡位进行替换";
  } else if (state.phase === "snorlax-second") {
    elements.statusText.textContent = "卡比兽：选择第二张要交换的牌";
  } else if (state.phase === "snorlax-first") {
    elements.statusText.textContent = "卡比兽：选择第一张要交换的牌";
  } else if (state.phase === "charizard-peek") {
    elements.statusText.textContent = "喷火龙：选择一张背面牌查看";
  } else if (state.phase === "rocket-choose") {
    elements.statusText.textContent = "火箭队：选择全桌一起更换的位置";
  } else if (state.phase === "ditto-choice") {
    elements.statusText.textContent = "百变怪：选择它要复制的相邻卡牌";
  } else if (state.phase === "round-end") {
    elements.statusText.textContent = "本轮已结算，等待房主开始下一轮";
  } else {
    elements.statusText.textContent = "对手行动中";
  }
}

function renderAll() {
  updateStatus();
  renderScores();
  renderOpponents();
  renderPlayer();
  renderDecks();
  renderCoin();
  renderLogs();
  elements.newGameButton.disabled = onlineMode;
}

function renderCoin() {
  const result = state.rocketHeads;
  elements.rocketCoin.classList.toggle("pending", result === null);
  elements.rocketCoin.classList.toggle("heads", result === true);
  elements.rocketCoin.classList.toggle("tails", result === false);
  elements.rocketCoin.classList.toggle("flipping", state.coinAnimating);
  elements.coinLabel.innerHTML = result === null
    ? state.coinAnimating ? "火箭队硬币<br /><strong>投掷中</strong>" : "火箭队硬币<br />待投"
    : `火箭队结果<br /><strong>${result ? "正面" : "反面"}</strong>`;
}

function renderScores() {
  elements.scoreList.innerHTML = state.players.map((player, index) => `
    <div class="score-row ${index === state.currentPlayer ? "active" : ""}">
      <span class="avatar ${avatarClasses[index]}">${index === 0 ? "P" : player.name.slice(0, 1)}</span>
      <span class="player-mini">${player.name}</span>
      <span class="badges">${Array.from({ length: TARGET_BADGES }, (_, badgeIndex) => `<i class="badge-dot ${badgeIndex < player.badges ? "filled" : ""}"></i>`).join("")}</span>
    </div>
  `).join("");
}

function renderOpponents() {
  elements.opponentsRow.innerHTML = state.players.slice(1).map((player, index) => `
    <div class="opponent ${state.currentPlayer === index + 1 ? "current" : ""}">
      <div class="opponent-head">
        <span class="avatar ${avatarClasses[index + 1]}">${player.name.slice(0, 1)}</span>
        <span class="opponent-name">${player.name}</span>
        <span class="opponent-score">${player.score === null ? "暗牌中" : `${player.score} 分`}</span>
      </div>
      <div class="mini-grid">${player.cards.map((card, cardIndex) => {
        const targetable = !state.busy
          && state.phase === "mew-target"
          && Boolean(state.pendingMew)
          && player.seat !== onlineLocalSeat;
        const shown = card.faceUp || state.roundLocked;
        const content = shown ? (card.type === "百变怪" && card.dittoTargetIndex == null ? "?" : card.value) : "";
        return `<button class="mini-card ${shown ? "face-up" : ""} ${targetable ? "targetable" : ""}" ${targetable ? `data-opponent-index="${index + 1}" data-opponent-card-index="${cardIndex}"` : "disabled"} style="${shown ? `--mini-card-bg:${card.color}` : ""}">${content}</button>`;
      }).join("")}</div>
    </div>
  `).join("");
  elements.opponentsRow.style.gridTemplateColumns = `repeat(${Math.max(1, state.players.length - 1)}, minmax(0, 1fr))`;
  elements.opponentsRow.querySelectorAll("[data-opponent-index]").forEach((button) => {
    button.addEventListener("click", () => selectOpponentCard(Number(button.dataset.opponentIndex), Number(button.dataset.opponentCardIndex)));
  });
}

function renderPlayer() {
  const player = state.players[0];
  elements.playerGrid.innerHTML = player.cards.map((card, index) => {
    const pendingDitto = state.pendingDittoChoices[0];
    const dittoTargetable = state.phase === "ditto-choice" && pendingDitto &&
      Math.floor(index / 3) === Math.floor(pendingDitto.cardIndex / 3) &&
      Math.abs(index % 3 - pendingDitto.cardIndex % 3) === 1;
    const selectable = !state.busy && state.currentPlayer === 0 && (
      (state.phase === "resolve" && state.drawnCard) ||
      state.phase === "mew-own" ||
      state.phase === "snorlax-first" ||
      (state.phase === "snorlax-second" && state.pendingSwap?.first !== index) ||
      state.phase === "rocket-choose" ||
      dittoTargetable ||
      (state.phase === "charizard-peek" && !card.faceUp)
    );
    return `
      <button class="game-card ${selectable ? "selectable" : ""}" data-card-index="${index}" aria-label="第 ${index + 1} 个卡位" ${selectable ? "" : "disabled"}>
        ${card.faceUp || state.roundLocked ? renderFaceUpCard(card, player.cards, index) : '<div class="card-back"></div>'}
      </button>
    `;
  }).join("");

  elements.playerGrid.querySelectorAll("[data-card-index]").forEach((button) => {
    button.addEventListener("click", () => selectPlayerCard(Number(button.dataset.cardIndex)));
  });

  if (state.phase === "draw") elements.playerHint.textContent = "先从上方选择摸牌堆或弃牌堆。";
  else if (state.phase === "rocket-flip") elements.playerHint.textContent = state.coinAnimating
    ? "火箭队：硬币投掷中，请稍候。"
    : "火箭队：查看硬币结果。";
  else if (state.phase === "resolve") {
    elements.playerHint.textContent = state.drawnCard?.type === "火箭队"
      ? "火箭队反面：选择一个卡位替换这张牌。"
      : "选择一个卡位替换这张待处理卡牌。";
  }
  else if (state.phase === "mew-target") elements.playerHint.textContent = `梦幻：选择一名对手，将你第 ${(state.pendingMew?.ownIndex ?? 0) + 1} 个位置换下的牌交给他。`;
  else if (state.phase === "mew-own") elements.playerHint.textContent = "梦幻：先选择自己的一个卡位，用梦幻替换它。";
  else if (state.phase === "snorlax-first") elements.playerHint.textContent = "卡比兽：先选择任意一张牌。";
  else if (state.phase === "snorlax-second") elements.playerHint.textContent = "卡比兽：选择另一张牌交换位置。";
  else if (state.phase === "charizard-peek") elements.playerHint.textContent = "选择一张背面牌查看，查看后会盖回。";
  else if (state.phase === "rocket-choose") elements.playerHint.textContent = "火箭队：选择一个卡位，全桌一起更换。";
  else if (state.phase === "ditto-choice") elements.playerHint.textContent = "百变怪：选择左侧或右侧相邻牌复制分值。";
  else if (state.phase === "ai") elements.playerHint.textContent = "对手正在轮流行动。";
  else elements.playerHint.textContent = "特殊卡效果处理中。";

  if (state.roundLocked) elements.playerScore.textContent = `${player.score} 分`;
  else elements.playerScore.textContent = "未揭晓";
}

function renderFaceUpCard(card, cards, index) {
  const value = card.type === "百变怪"
    && !Number.isInteger(card.dittoTargetIndex)
    && !Number.isFinite(card.dittoValue)
    ? "?"
    : getCardValue(card, cards, index);
  return `
    <div class="card-art" style="--card-bg: ${card.color}">
      <div class="card-top">
        <span class="card-type">${card.type}</span>
        <span class="card-value">${value}</span>
      </div>
      <div class="card-creature">${card.icon}</div>
      <div class="card-name">${card.name}</div>
      ${card.type !== "普通" ? `<span class="card-tag">能力</span>` : ""}
    </div>
  `;
}

function renderDecks() {
  elements.drawDeckCount.textContent = state.drawPile.length;
  elements.discardDeckCount.textContent = state.discardPile.length;
  elements.deckCount.textContent = `摸牌堆 ${state.drawPile.length}`;
  const discardTop = state.discardPile[state.discardPile.length - 1];
  elements.discardPreview.innerHTML = discardTop ? `
    <span class="discard-preview-art" style="--preview-bg: ${discardTop.color}">
      <b>${discardTop.type === "百变怪" ? "?" : discardTop.value}</b>
      <i>${discardTop.icon}</i>
    </span>
  ` : "";
  elements.discardPreview.title = discardTop ? `弃牌堆顶：${discardTop.name}，${discardTop.type === "百变怪" ? "数值待结算" : `${discardTop.value}分`}` : "弃牌堆为空";

  if (state.drawnCard) {
    elements.drawnCard.classList.add("has-card");
    elements.drawnCard.innerHTML = renderFaceUpCard(state.drawnCard, [state.drawnCard], 0);
    elements.drawnCard.title = `待处理：${state.drawnCard.name}，${state.drawnCard.type === "百变怪" ? "数值待结算" : `${state.drawnCard.value}分`}`;
  } else {
    elements.drawnCard.classList.remove("has-card");
    elements.drawnCard.innerHTML = '<span>等待抽牌</span>';
    elements.drawnCard.removeAttribute("title");
  }
  const canReject = state.drawnCard && state.drawnSource === "draw" && state.phase === "resolve" && state.drawnCard.type === "普通";
  elements.discardDrawnButton.classList.toggle("hidden", !canReject);
  elements.discardDrawnButton.disabled = state.busy || !canReject;
  document.querySelector("#drawDeckButton").disabled = state.busy || state.phase !== "draw" || state.currentPlayer !== 0 || state.roundLocked;
  document.querySelector("#discardDeckButton").disabled = state.busy || state.phase !== "draw" || state.currentPlayer !== 0 || state.roundLocked;
}

function renderLogs() {
  elements.logList.innerHTML = state.logs.length
    ? state.logs.map((log) => `<div class="log-entry"><span class="log-dot ${log.accent}"></span><p>${log.message}</p></div>`).join("")
    : '<div class="log-entry"><span class="log-dot"></span><p>等待第一步行动。</p></div>';
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

document.querySelector("#drawDeckButton").addEventListener("click", () => drawFrom("draw"));
document.querySelector("#discardDeckButton").addEventListener("click", () => drawFrom("discard"));
elements.discardDrawnButton.addEventListener("click", discardDrawnCard);
document.querySelector("#newGameButton").addEventListener("click", startFreshGame);
document.querySelector("#continueButton").addEventListener("click", continueGame);
document.querySelector("#rulesButton").addEventListener("click", () => openModal(elements.rulesModal));
document.querySelector("#rulesClose").addEventListener("click", () => closeModal(elements.rulesModal));

[elements.rulesModal, elements.messageModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal && modal === elements.rulesModal) closeModal(modal);
  });
});

elements.playerCountControl.querySelectorAll("[data-player-count]").forEach((button) => {
  button.addEventListener("click", () => {
    state.playerCount = Number(button.dataset.playerCount);
    elements.playerCountControl.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    startFreshGame();
  });
});

startFreshGame();
