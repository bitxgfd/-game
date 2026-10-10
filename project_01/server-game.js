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

function cloneCard(card) {
  return { ...card, faceUp: false, dittoValue: null, dittoTargetIndex: null };
}

function shuffle(list) {
  const array = [...list];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function addLog(state, message, accent = "normal") {
  state.logs.unshift({ message, accent });
  state.logs = state.logs.slice(0, 7);
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
  const values = player.cards.map((card, index) => {
    const value = getCardValue(card, player.cards, index);
    return Number.isFinite(value) ? value : 0;
  });
  let score = 0;
  for (let column = 0; column < 3; column += 1) {
    const top = column;
    const bottom = column + 3;
    if (values[top] === values[bottom]) continue;
    score += values[top] + values[bottom];
  }
  return score;
}

function dealCards(drawPile) {
  return Array.from({ length: 6 }, () => drawPile.pop());
}

function makeRound(players, round, roundStarter = 0) {
  const drawPile = shuffle(CARD_DEFS.map(cloneCard));
  const openingDiscard = drawPile.pop();
  openingDiscard.faceUp = true;
  const state = {
    round,
    roundStarter,
    currentPlayer: roundStarter,
    drawPile,
    discardPile: [openingDiscard],
    drawnCard: null,
    drawnSource: null,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      seat: player.seat,
      badges: player.badges || 0,
      cards: dealCards(drawPile),
      score: null,
    })),
    logs: [],
    phase: "draw",
    selectedCardIndex: null,
    rocketHeads: null,
    pendingMew: null,
    pendingSwap: null,
    peek: null,
    pendingDittoChoices: [],
    roundLocked: false,
    busy: false,
    coinAnimating: false,
    roundResult: null,
  };
  state.players.forEach((player) => {
    if (player.cards[4]) player.cards[4].faceUp = true;
  });
  addLog(state, round === 1 ? "新的一局开始，先从起始玩家行动。" : "上一轮冠军重新成为起始玩家。", "accent");
  return state;
}

function startGame(roomPlayers) {
  return makeRound(roomPlayers.map((player) => ({ ...player, badges: 0 })), 1, 0);
}

function refillFromDiscard(state, protectedIds = new Set()) {
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
  addLog(state, "摸牌堆耗尽，弃牌重新洗入摸牌堆。");
}

function drawRefillCard(state, protectedIds = new Set()) {
  if (state.drawPile.length === 0) refillFromDiscard(state, protectedIds);
  return state.drawPile.pop() || null;
}

function discardToBottom(state, cards) {
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    if (cards[index]) state.discardPile.unshift({ ...cards[index], faceUp: true });
  }
}

function replaceCard(state, playerIndex, cardIndex, incomingCard) {
  const player = state.players[playerIndex];
  const outgoing = player.cards[cardIndex];
  if (!player || !outgoing || !incomingCard) return null;
  state.discardPile.push({ ...outgoing, faceUp: true });
  player.cards[cardIndex] = { ...incomingCard, faceUp: true };
  return outgoing;
}

function publicCard(card, reveal) {
  if (!card) return null;
  if (reveal) return { ...card, faceUp: true };
  return { faceUp: false, hidden: true };
}

function publicState(state, viewerSeat) {
  return {
    round: state.round,
    roundStarter: state.roundStarter,
    currentPlayer: state.currentPlayer,
    drawPile: Array.from({ length: state.drawPile.length }, () => ({ hidden: true })),
    discardPile: state.discardPile.map((card) => ({ ...card })),
    drawnCard: state.drawnCard ? { ...state.drawnCard } : null,
    drawnSource: state.drawnSource,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      seat: player.seat,
      badges: player.badges,
      score: player.score,
    cards: player.cards.map((card, index) => publicCard(
      card,
      state.roundLocked
        || card.faceUp
        || (state.peek?.player === viewerSeat && state.peek.index === index && player.seat === viewerSeat),
    )),
    })),
    logs: state.logs.map((log) => ({ ...log })),
    phase: state.phase,
    selectedCardIndex: state.selectedCardIndex,
    rocketHeads: state.rocketHeads,
    pendingMew: state.pendingMew ? {
      ownCardIndex: Number.isInteger(state.pendingMew.ownCardIndex)
        ? state.pendingMew.ownCardIndex
        : null,
      targetPlayer: Number.isInteger(state.pendingMew.targetPlayer)
        ? state.pendingMew.targetPlayer
        : null,
    } : null,
    pendingSwap: state.pendingSwap ? { ...state.pendingSwap } : null,
    pendingDittoChoices: state.pendingDittoChoices
      .filter((choice) => choice.owner === viewerSeat)
      .map((choice) => ({ cardIndex: choice.cardIndex })),
    roundLocked: state.roundLocked,
    busy: state.busy,
    coinAnimating: state.coinAnimating,
    roundResult: state.roundResult,
    playerCount: state.players.length,
    localSeat: viewerSeat,
  };
}

function findPlayerIndex(state, playerId) {
  return state.players.findIndex((player) => player.id === playerId);
}

function validSeat(state, seat) {
  return Number.isInteger(seat) && seat >= 0 && seat < state.players.length;
}

function isCurrentActor(state, actorSeat) {
  return actorSeat === state.currentPlayer && !state.busy && !state.roundResult;
}

function setTimer(room, delay, callback) {
  const timer = setTimeout(() => {
    room.gameTimers?.delete(timer);
    if (!room.game) return;
    callback();
  }, delay);
  room.gameTimers ||= new Set();
  room.gameTimers.add(timer);
  return timer;
}

function clearTimer(room, timer) {
  clearTimeout(timer);
  room.gameTimers?.delete(timer);
}

function emit(room, broadcast) {
  if (room.game) broadcast(room);
}

function finishTurn(room, actorSeat, broadcast) {
  const state = room.game;
  if (checkRoundEnd(room, actorSeat, broadcast)) return;
  state.currentPlayer = (actorSeat + 1) % state.players.length;
  state.phase = "draw";
  state.drawnCard = null;
  state.drawnSource = null;
  state.selectedCardIndex = null;
  state.pendingMew = null;
  state.pendingSwap = null;
  state.rocketHeads = null;
  state.coinAnimating = false;
  state.busy = false;
  emit(room, broadcast);
}

function completeAfterDelay(room, actorSeat, broadcast, delay = STEP_DELAY) {
  const state = room.game;
  state.busy = true;
  emit(room, broadcast);
  setTimer(room, delay, () => finishTurn(room, actorSeat, broadcast));
}

function checkRoundEnd(room, playerIndex, broadcast) {
  const state = room.game;
  const player = state.players[playerIndex];
  if (!player || !player.cards.every((card) => card.faceUp)) return false;
  state.roundLocked = true;
  state.busy = false;
  state.players.forEach((item) => item.cards.forEach((card) => { card.faceUp = true; }));
  state.pendingDittoChoices = [];
  state.players.forEach((item, owner) => item.cards.forEach((card, cardIndex) => {
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
      return;
    }
    state.pendingDittoChoices.push({ owner, cardIndex });
  }));
  if (state.pendingDittoChoices.length) {
    state.currentPlayer = state.pendingDittoChoices[0].owner;
    state.phase = "ditto-choice";
    emit(room, broadcast);
    return true;
  }
  finalizeRound(room, broadcast);
  return true;
}

function finalizeRound(room, broadcast) {
  const state = room.game;
  state.players.forEach((player) => {
    const score = calculateScore(player);
    player.score = Number.isFinite(score) ? score : 0;
  });
  const lowest = Math.min(...state.players.map((player) => player.score));
  const winners = state.players.filter((player) => player.score === lowest);
  winners.forEach((player) => { player.badges += 1; });
  state.roundStarter = winners[0].seat;
  const gameWinners = winners.filter((player) => player.badges >= TARGET_BADGES);
  state.roundResult = {
    lowest,
    winners: winners.map((player) => ({ id: player.id, name: player.name, seat: player.seat })),
    gameWinners: gameWinners.map((player) => ({ id: player.id, name: player.name, seat: player.seat })),
  };
  state.phase = "round-end";
  state.currentPlayer = winners[0].seat;
  state.busy = false;
  addLog(state, `${winners.map((player) => player.name).join("、")}获得本轮徽章。`, "accent");
  emit(room, broadcast);
}

function drawAction(room, actorSeat, source, broadcast) {
  const state = room.game;
  if (!isCurrentActor(state, actorSeat) || state.phase !== "draw") return { error: "现在不能抽牌。" };
  if (source === "draw" && state.drawPile.length === 0) refillFromDiscard(state);
  if (source === "draw" && state.drawPile.length === 0) return { error: "摸牌堆为空。" };
  if (source === "discard" && state.discardPile.length === 0) return { error: "弃牌堆为空。" };
  const card = source === "draw" ? state.drawPile.pop() : state.discardPile.pop();
  if (!card) return { error: "没有抽到卡牌。" };
  card.faceUp = true;
  state.drawnCard = card;
  state.drawnSource = source;
  state.phase = "resolve";
  state.selectedCardIndex = null;
  state.busy = true;
  addLog(state, `${state.players[actorSeat].name}${source === "draw" ? "从摸牌堆抽到" : "拿起弃牌堆顶"}：${card.name}。`, "accent");
  emit(room, broadcast);
  setTimer(room, STEP_DELAY, () => afterDraw(room, actorSeat, broadcast));
  return {};
}

function afterDraw(room, actorSeat, broadcast) {
  const state = room.game;
  if (!state.drawnCard) return;
  if (state.drawnCard.type === "火箭队") {
    state.phase = "rocket-flip";
    state.rocketHeads = null;
    state.coinAnimating = true;
    state.busy = true;
    addLog(state, `${state.players[actorSeat].name}：硬币投掷中。`, "accent");
    emit(room, broadcast);
    setTimer(room, COIN_FLIP_DURATION, () => {
      state.coinAnimating = false;
      state.rocketHeads = Math.random() < 0.5;
      addLog(state, `${state.players[actorSeat].name}掷火箭队硬币：${state.rocketHeads ? "正面" : "反面"}。`, "accent");
      emit(room, broadcast);
      setTimer(room, STEP_DELAY, () => {
        state.phase = state.rocketHeads ? "rocket-choose" : "resolve";
        state.busy = false;
        emit(room, broadcast);
      });
    });
    return;
  }
  if (state.drawnCard.type === "梦幻") {
    state.pendingMew = { ownCardIndex: null, outgoingCard: null, targetPlayer: null };
    state.phase = "mew-own";
    addLog(state, `${state.players[actorSeat].name}发动梦幻：先选择自己的一个卡位。`, "accent");
  }
  state.busy = false;
  emit(room, broadcast);
}

function selectMewTarget(room, actorSeat, targetPlayer, broadcast) {
  const state = room.game;
  if (
    !isCurrentActor(state, actorSeat)
    || state.phase !== "mew-target"
    || !state.pendingMew
    || !Number.isInteger(state.pendingMew.ownCardIndex)
    || !state.pendingMew.outgoingCard
  ) {
    return { error: "现在不能选择梦幻目标。" };
  }
  if (!validSeat(state, targetPlayer) || targetPlayer === actorSeat) {
    return { error: "梦幻目标无效。" };
  }
  state.pendingMew.targetPlayer = targetPlayer;
  state.busy = true;
  state.selectedCardIndex = state.pendingMew.ownCardIndex;
  addLog(state, `梦幻：将第 ${state.pendingMew.ownCardIndex + 1} 个卡位的牌交给${state.players[targetPlayer].name}。`, "accent");
  emit(room, broadcast);
  setTimer(room, STEP_DELAY, () => {
    const target = state.players[targetPlayer];
    const position = state.pendingMew.ownCardIndex;
    const outgoing = state.pendingMew.outgoingCard;
    const discarded = target.cards[position];
    if (discarded) state.discardPile.push({ ...discarded, faceUp: true });
    target.cards[position] = { ...outgoing };
    state.drawnCard = null;
    state.drawnSource = null;
    state.pendingMew = null;
    state.selectedCardIndex = null;
    addLog(state, `梦幻效果：${state.players[actorSeat].name}将替换下来的牌放入${target.name}的第 ${position + 1} 个卡位，并弃掉原牌。`, "accent");
    completeAfterDelay(room, actorSeat, broadcast);
  });
  return {};
}

function selectDitto(room, actorSeat, index, broadcast) {
  const state = room.game;
  if (state.busy || state.phase !== "ditto-choice") return { error: "现在不能选择百变怪目标。" };
  const pending = state.pendingDittoChoices[0];
  if (!pending || pending.owner !== actorSeat) return { error: "还没轮到你处理百变怪。" };
  const card = state.players[actorSeat]?.cards[pending.cardIndex];
  if (!card || !Number.isInteger(index)) return { error: "百变怪目标无效。" };
  const row = Math.floor(pending.cardIndex / 3);
  const column = pending.cardIndex % 3;
  if (Math.floor(index / 3) !== row || Math.abs(index % 3 - column) !== 1) {
    return { error: "百变怪只能复制同排相邻卡牌。" };
  }
  state.busy = true;
  state.selectedCardIndex = index;
  emit(room, broadcast);
  setTimer(room, STEP_DELAY, () => {
    card.dittoTargetIndex = index;
    state.pendingDittoChoices.shift();
    state.selectedCardIndex = null;
    state.busy = false;
    if (state.pendingDittoChoices.length) {
      state.currentPlayer = state.pendingDittoChoices[0].owner;
      emit(room, broadcast);
      return;
    }
    finalizeRound(room, broadcast);
  });
  return {};
}

function executeZapdos(state, playerIndex, position) {
  const bird = state.drawnCard;
  let passCard = state.players[playerIndex].cards[position];
  state.players[playerIndex].cards[position] = { ...bird, faceUp: true };
  for (let offset = 1; offset < state.players.length; offset += 1) {
    const receiverIndex = (playerIndex + offset) % state.players.length;
    const outgoing = state.players[receiverIndex].cards[position];
    state.players[receiverIndex].cards[position] = { ...passCard, faceUp: true };
    passCard = outgoing;
  }
  state.discardPile.unshift({ ...passCard, faceUp: true });
  addLog(state, `${state.players[playerIndex].name}发动闪电鸟，卡牌顺时针传递。`);
}

function executeRocket(state, playerIndex, position) {
  const discarded = [
    state.drawnCard,
    ...state.players.map((player) => player.cards[position]),
  ].filter(Boolean);
  discardToBottom(state, discarded);
  const protectedIds = new Set(discarded.map((card) => card.id));
  for (let offset = 0; offset < state.players.length; offset += 1) {
    const refillIndex = (playerIndex + offset) % state.players.length;
    const refill = drawRefillCard(state, protectedIds);
    state.players[refillIndex].cards[position] = refill
      ? { ...refill, faceUp: false }
      : cloneCard(CARD_DEFS[0]);
  }
  addLog(state, `${state.players[playerIndex].name}掷出正面，所有玩家弃掉第 ${position + 1} 个卡位并从该玩家开始补牌，弃牌置底。`, "accent");
}

function resolveSelectedCard(room, actorSeat, index, broadcast) {
  const state = room.game;
  const incoming = state.drawnCard;
  if (!validSeat(state, actorSeat) || !Number.isInteger(index) || index < 0 || index >= 6) {
    return { error: "卡位无效。" };
  }
  if (!isCurrentActor(state, actorSeat)) return { error: "现在不能选择卡位。" };

  if (state.phase === "snorlax-first" && state.pendingSwap) {
    state.pendingSwap.first = index;
    state.phase = "snorlax-second";
    state.busy = true;
    addLog(state, `${state.players[actorSeat].name}：已选择第 ${index + 1} 个卡位，请再选择另一张牌。`, "accent");
    emit(room, broadcast);
    setTimer(room, STEP_DELAY, () => {
      state.busy = false;
      emit(room, broadcast);
    });
    return {};
  }

  if (state.phase === "snorlax-second" && state.pendingSwap) {
    if (state.pendingSwap.first === index) return { error: "请选择另一张牌。" };
    const first = state.pendingSwap.first;
    state.busy = true;
    state.selectedCardIndex = index;
    emit(room, broadcast);
    setTimer(room, STEP_DELAY, () => {
      [state.players[actorSeat].cards[first], state.players[actorSeat].cards[index]] = [
        state.players[actorSeat].cards[index],
        state.players[actorSeat].cards[first],
      ];
      addLog(state, `${state.players[actorSeat].name}发动卡比兽，交换了第 ${first + 1} 和第 ${index + 1} 个卡位。`);
      state.pendingSwap = null;
      state.selectedCardIndex = null;
      state.drawnCard = null;
      completeAfterDelay(room, actorSeat, broadcast);
    });
    return {};
  }

  if (state.phase === "mew-own" && state.pendingMew) {
    state.busy = true;
    state.selectedCardIndex = index;
    emit(room, broadcast);
    setTimer(room, STEP_DELAY, () => {
      const ownCard = state.players[actorSeat].cards[index];
      if (!ownCard || !state.drawnCard) {
        state.busy = false;
        state.selectedCardIndex = null;
        emit(room, broadcast);
        return;
      }
      state.players[actorSeat].cards[index] = { ...state.drawnCard, faceUp: true };
      state.pendingMew.ownCardIndex = index;
      state.pendingMew.outgoingCard = { ...ownCard };
      state.drawnCard = null;
      state.drawnSource = null;
      state.selectedCardIndex = null;
      state.phase = "mew-target";
      state.busy = false;
      addLog(state, `梦幻：请选择一名对手，将第 ${index + 1} 个卡位的牌交给他。`, "accent");
      emit(room, broadcast);
    });
    return {};
  }

  if (state.phase === "charizard-peek") {
    const card = state.players[actorSeat].cards[index];
    if (!card || card.faceUp) return { error: "请选择一张背面牌。" };
    state.busy = true;
    state.peek = { player: actorSeat, index };
    state.selectedCardIndex = index;
    addLog(state, `${state.players[actorSeat].name}用喷火龙查看了第 ${index + 1} 个卡位。`, "accent");
    emit(room, broadcast);
    setTimer(room, 1100, () => {
      state.peek = null;
      state.selectedCardIndex = null;
      completeAfterDelay(room, actorSeat, broadcast);
    });
    return {};
  }

  if (!incoming) return { error: "现在没有待处理卡牌。" };

  if (state.phase === "rocket-choose" && incoming.type === "火箭队") {
    state.busy = true;
    state.selectedCardIndex = index;
    emit(room, broadcast);
    setTimer(room, STEP_DELAY, () => {
      executeRocket(state, actorSeat, index);
      state.drawnCard = null;
      state.selectedCardIndex = null;
      completeAfterDelay(room, actorSeat, broadcast);
    });
    return {};
  }

  if (state.phase !== "resolve") return { error: "现在不能处理这张牌。" };
  state.busy = true;
  state.selectedCardIndex = index;
  emit(room, broadcast);
  setTimer(room, STEP_DELAY, () => {
    if (incoming.type === "闪电鸟") {
      executeZapdos(state, actorSeat, index);
      state.drawnCard = null;
      state.selectedCardIndex = null;
      completeAfterDelay(room, actorSeat, broadcast);
      return;
    }
    const outgoing = replaceCard(state, actorSeat, index, incoming);
    if (!outgoing) return;
    state.drawnCard = null;
    state.selectedCardIndex = null;
    addLog(state, `${state.players[actorSeat].name}用 ${incoming.name} 替换了第 ${index + 1} 个卡位。`);
    if (incoming.type === "卡比兽") {
      state.pendingSwap = { first: null };
      state.phase = "snorlax-first";
      state.busy = false;
      addLog(state, "卡比兽效果：请选择任意一张牌作为交换起点。", "accent");
      emit(room, broadcast);
      return;
    }
    if (incoming.type === "喷火龙" && state.players[actorSeat].cards.some((card) => !card.faceUp)) {
      state.phase = "charizard-peek";
      state.busy = false;
      addLog(state, "喷火龙效果：选择一张背面牌查看。", "accent");
      emit(room, broadcast);
      return;
    }
    if (incoming.type === "百变怪") addLog(state, "百变怪会在结算时复制相邻卡牌分值。");
    if (incoming.type === "火箭队") addLog(state, "火箭队反面：替换了一个卡位。");
    completeAfterDelay(room, actorSeat, broadcast);
  });
  return {};
}

function applyAction(room, actorId, action, payload, broadcast) {
  const state = room.game;
  if (!state) return { error: "牌局尚未开始。" };
  const actorSeat = findPlayerIndex(state, actorId);
  if (!validSeat(state, actorSeat)) return { error: "你已经不在这局牌中。" };
  const data = payload && typeof payload === "object" ? payload : {};

  if (action === "draw_deck") return drawAction(room, actorSeat, "draw", broadcast);
  if (action === "draw_discard") return drawAction(room, actorSeat, "discard", broadcast);
  if (action === "select_card") return resolveSelectedCard(room, actorSeat, Number(data.index), broadcast);
  if (action === "select_opponent_card") {
    return selectMewTarget(room, actorSeat, Number(data.playerIndex), broadcast);
  }
  if (action === "select_mew_target") {
    return selectMewTarget(room, actorSeat, Number(data.playerIndex), broadcast);
  }
  if (action === "select_ditto") return selectDitto(room, actorSeat, Number(data.index), broadcast);
  if (action === "discard_drawn") {
    if (!isCurrentActor(state, actorSeat) || state.phase !== "resolve" || state.drawnSource !== "draw" || state.drawnCard?.type !== "普通") {
      return { error: "这张牌现在不能弃掉。" };
    }
    state.busy = true;
    state.discardPile.push({ ...state.drawnCard, faceUp: true });
    addLog(state, `${state.players[actorSeat].name}将 ${state.drawnCard.name} 放入了弃牌堆。`);
    state.drawnCard = null;
    emit(room, broadcast);
    completeAfterDelay(room, actorSeat, broadcast);
    return {};
  }
  return { error: "未知的牌局操作。" };
}

function continueRound(room, actorId, broadcast) {
  const state = room.game;
  if (!state?.roundResult) return { error: "当前没有等待继续的轮次。" };
  if (actorId !== room.hostId) return { error: "只有房主可以开始下一轮。" };
  const hasWinner = state.roundResult.gameWinners.length > 0;
  const players = state.players.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    badges: hasWinner ? 0 : player.badges,
  }));
  room.game = makeRound(players, hasWinner ? 1 : state.round + 1, hasWinner ? 0 : state.roundStarter);
  emit(room, broadcast);
  return {};
}

function cancelTimers(room) {
  for (const timer of room.gameTimers || []) clearTimeout(timer);
  room.gameTimers = new Set();
}

module.exports = {
  TARGET_BADGES,
  startGame,
  publicState,
  applyAction,
  continueRound,
  cancelTimers,
};
