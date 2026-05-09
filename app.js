"use strict";

const PLAYERS = {
  light: { key: "light", name: "Hell", sign: -1, dir: -1, home: [0, 1, 2, 3, 4, 5] },
  dark: { key: "dark", name: "Dunkel", sign: 1, dir: 1, home: [18, 19, 20, 21, 22, 23] },
};

const TOP_POINTS = [12, 13, 14, 15, 16, 17, "spacer", 18, 19, 20, 21, 22, 23];
const BOTTOM_POINTS = [11, 10, 9, 8, 7, 6, "spacer", 5, 4, 3, 2, 1, 0];
const POINT_COLOR_BY_ROW = {
  bottom: ["dark", "light", "dark", "light", "dark", "light", "spacer", "dark", "light", "dark", "light", "dark", "light"],
  top: ["light", "dark", "light", "dark", "light", "dark", "spacer", "light", "dark", "light", "dark", "light", "dark"],
};
const STORAGE_THEME = "backgammon-theme";
const STORAGE_LARGE = "backgammon-large";
const STORAGE_OPPONENT = "backgammon-opponent";
const STORAGE_DIFFICULTY = "backgammon-difficulty";

const state = {
  points: [],
  bar: { light: 0, dark: 0 },
  off: { light: 0, dark: 0 },
  turn: "light",
  dice: [],
  remainingDice: [],
  selected: null,
  moveCount: 0,
  history: [],
  seconds: 0,
  timerId: null,
  started: false,
  message: "",
  gameOver: false,
  opponent: "cpu",
  difficulty: "normal",
  npcThinking: false,
  npcTimerId: null,
  moveLog: [],
  traceTimerId: null,
};

const els = {
  pointsTop: document.querySelector("#pointsTop"),
  pointsBottom: document.querySelector("#pointsBottom"),
  barLight: document.querySelector("#barLight"),
  barDark: document.querySelector("#barDark"),
  barLightStack: document.querySelector("#barLightStack"),
  barDarkStack: document.querySelector("#barDarkStack"),
  bearOffLight: document.querySelector("#bearOffLight"),
  bearOffDark: document.querySelector("#bearOffDark"),
  lightOff: document.querySelector("#lightOff"),
  darkOff: document.querySelector("#darkOff"),
  lightScore: document.querySelector("#lightScore"),
  darkScore: document.querySelector("#darkScore"),
  turnLabel: document.querySelector("#turnLabel"),
  turnStat: document.querySelector("#turnStat"),
  diceStat: document.querySelector("#diceStat"),
  moveCount: document.querySelector("#moveCount"),
  timer: document.querySelector("#timer"),
  notice: document.querySelector("#notice"),
  diceTray: document.querySelector("#diceTray"),
  moveLog: document.querySelector("#moveLog"),
  moveOverlay: document.querySelector("#moveOverlay"),
  movePath: document.querySelector("#movePath"),
  moveGhost: document.querySelector("#moveGhost"),
  rollBtn: document.querySelector("#rollBtn"),
  undoBtn: document.querySelector("#undoBtn"),
  newGameBtn: document.querySelector("#newGameBtn"),
  opponentSelect: document.querySelector("#opponentSelect"),
  difficultySelect: document.querySelector("#difficultySelect"),
  themeSelect: document.querySelector("#themeSelect"),
  largeMode: document.querySelector("#largeMode"),
};

init();

function init() {
  buildPointButtons();

  const savedTheme = localStorage.getItem(STORAGE_THEME) || "felt";
  const large = localStorage.getItem(STORAGE_LARGE) !== "false";
  const opponent = localStorage.getItem(STORAGE_OPPONENT) || "cpu";
  const difficulty = localStorage.getItem(STORAGE_DIFFICULTY) || "normal";
  document.body.dataset.theme = savedTheme;
  document.body.dataset.large = String(large);
  els.themeSelect.value = savedTheme;
  els.largeMode.checked = large;
  state.opponent = opponent;
  state.difficulty = difficulty;
  els.opponentSelect.value = opponent;
  els.difficultySelect.value = difficulty;

  els.rollBtn.addEventListener("click", rollDice);
  els.undoBtn.addEventListener("click", undo);
  els.newGameBtn.addEventListener("click", newGame);
  els.opponentSelect.addEventListener("change", () => {
    state.opponent = els.opponentSelect.value;
    localStorage.setItem(STORAGE_OPPONENT, state.opponent);
    if (state.opponent === "cpu" && state.turn === "dark") {
      state.message = "Computer übernimmt Dunkel.";
      render();
      scheduleNpcTurn();
    } else {
      state.message = "Dunkel wird manuell gespielt.";
      render();
    }
  });
  els.difficultySelect.addEventListener("change", () => {
    state.difficulty = els.difficultySelect.value;
    localStorage.setItem(STORAGE_DIFFICULTY, state.difficulty);
    render();
  });
  els.themeSelect.addEventListener("change", () => {
    document.body.dataset.theme = els.themeSelect.value;
    localStorage.setItem(STORAGE_THEME, els.themeSelect.value);
  });
  els.largeMode.addEventListener("change", () => {
    document.body.dataset.large = String(els.largeMode.checked);
    localStorage.setItem(STORAGE_LARGE, String(els.largeMode.checked));
  });
  [els.barLight, els.barDark, els.bearOffLight, els.bearOffDark].forEach((node) => {
    node.addEventListener("click", () => handleSpecialClick(node.dataset.source || node.dataset.target));
  });

  newGame();
}

function buildPointButtons() {
  els.pointsTop.replaceChildren(...TOP_POINTS.map((point, index) => makePointNode(point, "top", index)));
  els.pointsBottom.replaceChildren(...BOTTOM_POINTS.map((point, index) => makePointNode(point, "bottom", index)));
}

function makePointNode(point, row, index) {
  if (point === "spacer") {
    const spacer = document.createElement("div");
    spacer.className = "point-spacer";
    return spacer;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = `point ${row} point-${POINT_COLOR_BY_ROW[row][index]}`;
  button.dataset.point = String(point);
  button.innerHTML = '<span class="point-label"></span><div class="checker-stack"></div>';
  button.querySelector(".point-label").textContent = String(point + 1);
  button.addEventListener("click", () => handlePointClick(point));
  return button;
}

function newGame() {
  cancelNpcTurn();
  clearMoveTrace();
  stopTimer();
  state.points = Array(24).fill(0);
  state.points[23] = -2;
  state.points[12] = -5;
  state.points[7] = -3;
  state.points[5] = -5;
  state.points[0] = 2;
  state.points[11] = 5;
  state.points[16] = 3;
  state.points[18] = 5;
  state.bar = { light: 0, dark: 0 };
  state.off = { light: 0, dark: 0 };
  state.turn = "light";
  state.dice = [];
  state.remainingDice = [];
  state.selected = null;
  state.moveCount = 0;
  state.history = [];
  state.seconds = 0;
  state.started = false;
  state.message = state.opponent === "cpu"
    ? "Hell beginnt gegen den Computer. Bitte würfeln."
    : "Hell beginnt. Bitte würfeln.";
  state.gameOver = false;
  state.npcThinking = false;
  state.moveLog = [];
  render();
}

function rollDice(options = {}) {
  if (state.gameOver) return;
  if (isNpcTurn() && !options.auto) {
    flash("Der Computer ist am Zug.");
    return;
  }
  if (state.remainingDice.length) {
    flash(`${currentPlayer().name} hat noch Züge offen.`);
    return;
  }

  pushHistory();
  startTimer();

  const first = randomDie();
  const second = randomDie();
  state.dice = first === second ? [first, first, first, first] : [first, second];
  state.remainingDice = [...state.dice];
  state.selected = null;

  const legalMoves = getLegalMoves();
  if (!legalMoves.length) {
    const playerName = currentPlayer().name;
    const diceText = formatDice(state.dice);
    recordPass(state.turn, diceText);
    state.dice = [];
    state.remainingDice = [];
    switchTurn(`${playerName} kann ${diceText} nicht setzen.`);
    return;
  }

  state.message = `${currentPlayer().name} setzt ${formatDice(state.remainingDice)}.`;
  render();
  scheduleNpcTurn();
}

function handlePointClick(point) {
  if (state.gameOver) return;
  if (isNpcTurn()) {
    flash("Der Computer ist am Zug.");
    return;
  }
  const legalMoves = getLegalMoves();
  const source = sourceFromPoint(point);
  const player = currentPlayer();

  if (!state.remainingDice.length) {
    flash("Erst würfeln.");
    return;
  }

  if (state.selected) {
    const move = legalMoves.find((item) => sameSource(item.from, state.selected) && item.to === point);
    if (move) {
      performMove(move);
      return;
    }

    const offMove = legalMoves.find((item) => sameSource(item.from, state.selected) && item.to === "off");
    if (sameSource(state.selected, point) && offMove) {
      performMove(offMove);
      return;
    }

    const sequence = findChainedMove(state.selected, point);
    if (sequence) {
      performMoveSequence(sequence);
      return;
    }
  }

  if (source && source.player === player.key) {
    const sourceMoves = legalMoves.filter((move) => sameSource(move.from, point));
    if (sourceMoves.length) {
      state.selected = point;
      state.message = `${player.name}: Zielpunkt wählen.`;
      render();
      return;
    }
  }

  if (state.selected && predictBlockedTarget(point)) {
    flash("Dieser Punkt ist besetzt.");
    return;
  }

  flash("Kein legaler Zug.");
}

function handleSpecialClick(token) {
  if (state.gameOver) return;
  if (isNpcTurn()) {
    flash("Der Computer ist am Zug.");
    return;
  }
  const legalMoves = getLegalMoves();
  const player = currentPlayer();

  if (token === "bar-light" || token === "bar-dark") {
    const barPlayer = token === "bar-light" ? "light" : "dark";
    if (barPlayer !== player.key || state.bar[player.key] <= 0) {
      flash("Hier liegt kein eigener Stein.");
      return;
    }
    const sourceMoves = legalMoves.filter((move) => move.from === "bar");
    if (!sourceMoves.length) {
      flash("Bar ist blockiert.");
      return;
    }
    state.selected = "bar";
    state.message = `${player.name}: von der Bar einspielen.`;
    render();
    return;
  }

  if ((token === "off-light" || token === "off-dark") && state.selected) {
    const move = legalMoves.find((item) => sameSource(item.from, state.selected) && item.to === "off");
    if (move) {
      performMove(move);
      return;
    }
    const sequence = findChainedMove(state.selected, "off");
    if (sequence) performMoveSequence(sequence);
  }
}

function performMove(move) {
  const notation = formatMoveNotation(move);
  pushHistory();
  applyMoveToState(state, move);
  state.moveCount += 1;
  recordMove(move, notation);
  removeDie(move.die);
  state.selected = null;

  const player = PLAYERS[move.player];
  if (state.off[move.player] === 15) {
    state.gameOver = true;
    state.message = `${player.name} gewinnt nach ${state.moveCount} Zügen.`;
    stopTimer();
    render();
    return;
  }

  if (!state.remainingDice.length) {
    switchTurn(`${player.name} hat den Zug beendet.`);
    return;
  }

  const legalMoves = getLegalMoves();
  if (!legalMoves.length) {
    const diceText = formatDice(state.remainingDice);
    recordPass(state.turn, diceText);
    state.remainingDice = [];
    switchTurn(`${player.name} kann ${diceText} nicht weiter setzen.`);
    return;
  }

  state.message = `${player.name}: ${formatDice(state.remainingDice)} übrig.`;
  render();
  scheduleNpcTurn();
}

function performMoveSequence(sequence) {
  if (!sequence.length) return;
  const notations = sequence.map((move) => formatMoveNotation(move));
  pushHistory();
  sequence.forEach((move, index) => {
    applyMoveToState(state, move);
    state.moveCount += 1;
    removeDie(move.die);
    if (index === sequence.length - 1) {
      recordSequence(sequence, notations);
    }
  });
  state.selected = null;

  const last = sequence[sequence.length - 1];
  const player = PLAYERS[last.player];
  if (state.off[last.player] === 15) {
    state.gameOver = true;
    state.message = `${player.name} gewinnt nach ${state.moveCount} Zügen.`;
    stopTimer();
    render();
    return;
  }

  if (!state.remainingDice.length) {
    switchTurn(`${player.name} hat den Zug beendet.`);
    return;
  }

  const legalMoves = getLegalMoves();
  if (!legalMoves.length) {
    const diceText = formatDice(state.remainingDice);
    recordPass(state.turn, diceText);
    state.remainingDice = [];
    switchTurn(`${player.name} kann ${diceText} nicht weiter setzen.`);
    return;
  }

  state.message = `${player.name}: ${formatDice(state.remainingDice)} übrig.`;
  render();
}

function undo() {
  cancelNpcTurn();
  const previous = state.history.pop();
  if (!previous) {
    flash("Nichts zum Zurücknehmen.");
    return;
  }
  restoreSnapshot(previous);
  render();
}

function switchTurn(reason) {
  state.turn = state.turn === "light" ? "dark" : "light";
  state.dice = [];
  state.remainingDice = [];
  state.selected = null;
  state.npcThinking = false;
  state.message = `${reason} ${currentPlayer().name} ist dran.`;
  render();
  scheduleNpcTurn();
}

function scheduleNpcTurn() {
  if (!isNpcTurn() || state.npcTimerId) return;
  state.npcThinking = true;
  state.message = state.remainingDice.length ? "Computer wählt einen Zug." : "Computer würfelt.";
  render();
  state.npcTimerId = window.setTimeout(() => {
    state.npcTimerId = null;
    state.npcThinking = false;
    if (!isNpcTurn()) return;
    if (!state.remainingDice.length) {
      rollDice({ auto: true });
      return;
    }
    const move = chooseNpcMove();
    if (move) {
      playNpcMove(move);
    } else {
      recordPass(state.turn, formatDice(state.remainingDice));
      state.remainingDice = [];
      switchTurn("Computer kann nicht setzen.");
    }
  }, 520);
}

function cancelNpcTurn() {
  if (state.npcTimerId) window.clearTimeout(state.npcTimerId);
  state.npcTimerId = null;
  state.npcThinking = false;
}

function playNpcMove(move) {
  const notation = formatMoveNotation(move);
  state.npcThinking = true;
  state.message = `Computer zieht ${notation}.`;
  showMoveTrace(move, notation);
  render();
  state.npcTimerId = window.setTimeout(() => {
    state.npcTimerId = null;
    state.npcThinking = false;
    if (isNpcTurn()) performMove(move);
  }, 1100);
}

function chooseNpcMove() {
  const moves = getLegalMoves();
  if (!moves.length) return null;
  if (state.difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];

  const ranked = moves
    .map((move) => ({ move, score: scoreNpcMove(move, state.difficulty) }))
    .sort((a, b) => b.score - a.score);

  if (state.difficulty === "normal" && ranked.length > 2) {
    return ranked[Math.floor(Math.random() * Math.min(2, ranked.length))].move;
  }
  return ranked[0].move;
}

function scoreNpcMove(move, difficulty) {
  const before = cloneSnapshot(state);
  const after = cloneSnapshot(state);
  const opponent = move.player === "light" ? "dark" : "light";
  const fromCount = move.from === "bar" ? before.bar[move.player] : Math.abs(before.points[move.from]);
  const hits = move.to !== "off" && ownerOf(before.points[move.to]) === opponent && Math.abs(before.points[move.to]) === 1;
  applyMoveToState(after, move);

  let score = 0;
  score += move.die * 1.1;
  if (move.from === "bar") score += 28;
  if (move.to === "off") score += difficulty === "hard" ? 34 : 24;
  if (hits) score += difficulty === "hard" ? 30 : 20;
  if (move.to !== "off" && ownerOf(after.points[move.to]) === move.player && Math.abs(after.points[move.to]) >= 2) score += 12;
  if (fromCount === 2 && move.from !== "bar") score -= difficulty === "hard" ? 12 : 6;
  score += homeProgressScore(after, move.player) - homeProgressScore(before, move.player);
  score -= exposedBlots(after, move.player) * (difficulty === "hard" ? 5 : 2);
  score += blockedPoints(after, move.player) * (difficulty === "hard" ? 2 : 1);
  score += Math.random() * (difficulty === "hard" ? 0.3 : 5);
  return score;
}

function homeProgressScore(snapshot, playerKey) {
  return snapshot.points.reduce((sum, value, point) => {
    if (ownerOf(value) !== playerKey) return sum;
    const count = Math.abs(value);
    const progress = playerKey === "light" ? 23 - point : point;
    return sum + count * progress;
  }, snapshot.off[playerKey] * 30);
}

function exposedBlots(snapshot, playerKey) {
  return snapshot.points.filter((value) => ownerOf(value) === playerKey && Math.abs(value) === 1).length;
}

function blockedPoints(snapshot, playerKey) {
  return snapshot.points.filter((value) => ownerOf(value) === playerKey && Math.abs(value) >= 2).length;
}

function isNpcTurn(snapshot = state) {
  return snapshot.turn === "dark" && snapshot.opponent === "cpu" && !snapshot.gameOver;
}

function getLegalMoves(snapshot = state) {
  if (!snapshot.remainingDice.length || snapshot.gameOver) return [];
  const sequences = buildMoveSequences(snapshot, snapshot.remainingDice);
  if (!sequences.length) return [];

  const maxLength = Math.max(...sequences.map((sequence) => sequence.length));
  let best = sequences.filter((sequence) => sequence.length === maxLength && sequence.length > 0);
  const distinct = [...new Set(snapshot.remainingDice)];

  if (maxLength === 1 && distinct.length === 2) {
    const high = Math.max(...distinct);
    const hasHigh = best.some((sequence) => sequence[0].die === high);
    if (hasHigh) best = best.filter((sequence) => sequence[0].die === high);
  }

  best = includeExactOnePointBearOff(snapshot, best, sequences);

  return uniqueMoves(best.map((sequence) => sequence[0]));
}

function includeExactOnePointBearOff(snapshot, best, sequences) {
  if (!snapshot.remainingDice.includes(1)) return best;
  const onePoint = snapshot.turn === "light" ? 0 : 23;
  const exactBearOff = sequences.find((sequence) => {
    const move = sequence[0];
    return move
      && move.from === onePoint
      && move.to === "off"
      && move.die === 1
      && sequence.length === Math.max(...best.map((item) => item.length));
  });
  if (!exactBearOff) return best;
  return [...best, exactBearOff];
}

function findChainedMove(from, target) {
  const playerKey = state.turn;
  const sequences = buildMoveSequences(cloneSnapshot(state), state.remainingDice)
    .filter((sequence) => sequence.length > 1 && sameSource(sequence[0].from, from));

  const matching = sequences
    .map((sequence) => takeSameCheckerPath(sequence, target))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || sumDice(b) - sumDice(a));

  const best = matching[0];
  if (!best || best.some((move) => move.player !== playerKey)) return null;
  return best;
}

function getChainedTargets(from) {
  return buildMoveSequences(cloneSnapshot(state), state.remainingDice)
    .filter((sequence) => sequence.length > 1 && sameSource(sequence[0].from, from))
    .map((sequence) => {
      const path = takeSameCheckerPrefix(sequence);
      return path.length > 1 ? path[path.length - 1].to : null;
    })
    .filter((target) => target !== null);
}

function takeSameCheckerPrefix(sequence) {
  const path = [];
  for (const move of sequence) {
    if (path.length && !sameSource(move.from, path[path.length - 1].to)) break;
    path.push(move);
    if (move.to === "off") break;
  }
  return path;
}

function takeSameCheckerPath(sequence, target) {
  const path = [];
  for (const move of sequence) {
    if (path.length && !sameSource(move.from, path[path.length - 1].to)) break;
    path.push(move);
    if (move.to === target || (target !== "off" && move.to === Number(target))) return path;
    if (move.to === "off") break;
  }
  return null;
}

function sumDice(sequence) {
  return sequence.reduce((sum, move) => sum + move.die, 0);
}

function buildMoveSequences(snapshot, dice) {
  const movesByDie = uniqueDice(dice).flatMap((die) => {
    const moves = singleDieMoves(snapshot, snapshot.turn, die);
    return moves.map((move) => ({ die, move }));
  });

  if (!movesByDie.length) return [];

  const sequences = [];
  movesByDie.forEach(({ die, move }) => {
    const next = cloneSnapshot(snapshot);
    applyMoveToState(next, move);
    next.remainingDice = removeDieFromList(dice, die);
    const tails = buildMoveSequences(next, next.remainingDice);
    if (tails.length) {
      tails.forEach((tail) => sequences.push([move, ...tail]));
    } else {
      sequences.push([move]);
    }
  });
  return sequences;
}

function singleDieMoves(snapshot, playerKey, die) {
  const player = PLAYERS[playerKey];
  const moves = [];

  if (snapshot.bar[playerKey] > 0) {
    const entry = playerKey === "light" ? 24 - die : die - 1;
    if (canLand(snapshot, playerKey, entry)) {
      moves.push({ player: playerKey, from: "bar", to: entry, die });
    }
    return moves;
  }

  snapshot.points.forEach((value, index) => {
    if (ownerOf(value) !== playerKey) return;
    const target = index + player.dir * die;
    if (target >= 0 && target < 24) {
      if (canLand(snapshot, playerKey, target)) {
        moves.push({ player: playerKey, from: index, to: target, die });
      }
      return;
    }

    if (canBearOff(snapshot, playerKey, index, die)) {
      moves.push({ player: playerKey, from: index, to: "off", die });
    }
  });

  return moves;
}

function canLand(snapshot, playerKey, point) {
  const owner = ownerOf(snapshot.points[point]);
  const count = Math.abs(snapshot.points[point]);
  return !owner || owner === playerKey || count === 1;
}

function canBearOff(snapshot, playerKey, index, die) {
  const player = PLAYERS[playerKey];
  if (snapshot.bar[playerKey] > 0) return false;
  const allHome = snapshot.points.every((value, point) => {
    if (ownerOf(value) !== playerKey) return true;
    return player.home.includes(point);
  });
  if (!allHome) return false;

  if (playerKey === "light") {
    const exactDistance = index + 1;
    if (die === exactDistance) return true;
    if (die < exactDistance) return false;
    return !snapshot.points.some((value, point) => ownerOf(value) === playerKey && point > index);
  }

  const exactDistance = 24 - index;
  if (die === exactDistance) return true;
  if (die < exactDistance) return false;
  return !snapshot.points.some((value, point) => ownerOf(value) === playerKey && point < index);
}

function applyMoveToState(targetState, move) {
  const player = PLAYERS[move.player];
  const opponent = move.player === "light" ? "dark" : "light";

  if (move.from === "bar") {
    targetState.bar[move.player] -= 1;
  } else {
    targetState.points[move.from] -= player.sign;
  }

  if (move.to === "off") {
    targetState.off[move.player] += 1;
    return;
  }

  const destinationOwner = ownerOf(targetState.points[move.to]);
  if (destinationOwner === opponent && Math.abs(targetState.points[move.to]) === 1) {
    targetState.points[move.to] = 0;
    targetState.bar[opponent] += 1;
  }

  targetState.points[move.to] += player.sign;
}

function render() {
  const legalMoves = getLegalMoves();
  const legalSources = new Set(legalMoves.map((move) => sourceKey(move.from)));
  const legalTargets = new Set(
    state.selected
      ? [
          ...legalMoves.filter((move) => sameSource(move.from, state.selected)).map((move) => targetKey(move.to)),
          ...getChainedTargets(state.selected).map(targetKey),
        ]
      : [],
  );

  document.querySelectorAll(".point").forEach((pointNode) => {
    const point = Number(pointNode.dataset.point);
    const value = state.points[point];
    const owner = ownerOf(value);
    const count = Math.abs(value);

    pointNode.classList.toggle("selectable", legalSources.has(sourceKey(point)));
    pointNode.classList.toggle("selected", sameSource(point, state.selected));
    pointNode.classList.toggle("destination", legalTargets.has(targetKey(point)));
    pointNode.classList.remove("blocked-target");
    pointNode.setAttribute("aria-label", describePoint(point, owner, count));
    renderStack(pointNode.querySelector(".checker-stack"), owner, count);
  });

  renderBar("light", legalSources);
  renderBar("dark", legalSources);
  renderBearOff(legalTargets);
  renderDice();

  const player = currentPlayer();
  els.turnLabel.textContent = state.gameOver ? "Partie beendet" : `${player.name} am Zug`;
  els.turnStat.textContent = player.name;
  els.diceStat.textContent = state.remainingDice.length ? formatDice(state.remainingDice) : "--";
  els.moveCount.textContent = String(state.moveCount);
  els.timer.textContent = formatTime(state.seconds);
  els.notice.textContent = state.message;
  els.lightOff.textContent = String(state.off.light);
  els.darkOff.textContent = String(state.off.dark);
  els.lightScore.textContent = `${state.off.light} / 15`;
  els.darkScore.textContent = `${state.off.dark} / 15`;
  els.rollBtn.disabled = state.gameOver || state.remainingDice.length > 0 || isNpcTurn();
  els.undoBtn.disabled = state.history.length === 0 || state.npcThinking;
  els.difficultySelect.disabled = state.opponent !== "cpu";
  renderMoveLog();
}

function renderBar(playerKey, legalSources) {
  const bar = playerKey === "light" ? els.barLight : els.barDark;
  const stack = playerKey === "light" ? els.barLightStack : els.barDarkStack;
  const count = state.bar[playerKey];
  bar.dataset.source = `bar-${playerKey}`;
  bar.classList.toggle("selectable", state.turn === playerKey && legalSources.has("bar"));
  bar.classList.toggle("selected", state.selected === "bar" && state.turn === playerKey);
  bar.setAttribute("aria-label", `${PLAYERS[playerKey].name} Bar, ${count} Steine`);
  renderStack(stack, playerKey, count);
}

function renderBearOff(legalTargets) {
  const canBearOff = legalTargets.has("off");
  els.bearOffLight.dataset.target = "off-light";
  els.bearOffDark.dataset.target = "off-dark";
  els.bearOffLight.classList.toggle("destination", canBearOff && state.turn === "light");
  els.bearOffDark.classList.toggle("destination", canBearOff && state.turn === "dark");
}

function renderDice() {
  if (!state.dice.length) {
    els.diceTray.replaceChildren(emptyDiceNote());
    return;
  }

  const remaining = [...state.remainingDice];
  els.diceTray.replaceChildren(
    ...state.dice.map((die) => {
      const node = document.createElement("span");
      const stillAvailable = remaining.includes(die);
      if (stillAvailable) remaining.splice(remaining.indexOf(die), 1);
      node.className = stillAvailable ? "die" : "die used";
      node.textContent = String(die);
      return node;
    }),
  );
}

function emptyDiceNote() {
  const node = document.createElement("span");
  node.className = "die used";
  node.textContent = "-";
  return node;
}

function renderStack(container, owner, count) {
  container.replaceChildren();
  if (!owner || count <= 0) return;

  const visible = Math.min(count, 5);
  for (let i = 0; i < visible; i += 1) {
    const checker = document.createElement("span");
    checker.className = `checker ${owner}`;
    checker.style.setProperty("--slot-index", String(i));
    container.appendChild(checker);
  }

  if (count > 5) {
    const badge = document.createElement("span");
    badge.className = "count-badge";
    badge.textContent = String(count);
    container.appendChild(badge);
  }
}

function recordMove(move, notation) {
  state.moveLog.unshift({
    player: PLAYERS[move.player].name,
    notation,
    die: move.die,
    moveNo: state.moveCount,
  });
  state.moveLog = state.moveLog.slice(0, 24);
}

function recordSequence(sequence, notations) {
  const player = PLAYERS[sequence[0].player].name;
  state.moveLog.unshift({
    player,
    notation: collapseSequenceNotation(sequence, notations),
    die: sequence.map((move) => move.die).join("+"),
    moveNo: state.moveCount - sequence.length + 1,
  });
  state.moveLog = state.moveLog.slice(0, 24);
}

function recordPass(playerKey, diceText) {
  if (!diceText) return;
  state.moveLog.unshift({
    type: "pass",
    player: PLAYERS[playerKey].name,
    notation: `passt ${diceText}`,
    die: diceText,
    moveNo: state.moveCount + 1,
  });
  state.moveLog = state.moveLog.slice(0, 24);
}

function renderMoveLog() {
  els.moveLog.replaceChildren(
    ...state.moveLog.map((entry) => {
      const item = document.createElement("li");
      item.textContent = entry.type === "pass"
        ? `${entry.moveNo}. ${entry.player}: ${entry.notation}`
        : `${entry.moveNo}. ${entry.player}: ${entry.notation} (${entry.die})`;
      return item;
    }),
  );
}

function formatMoveNotation(move) {
  const from = move.from === "bar" ? "bar" : String(move.from + 1);
  const to = move.to === "off" ? "off" : String(move.to + 1);
  const hit = move.to !== "off"
    && ownerOf(state.points[move.to]) === (move.player === "light" ? "dark" : "light")
    && Math.abs(state.points[move.to]) === 1;
  return `${from}/${to}${hit ? "*" : ""}`;
}

function collapseSequenceNotation(sequence, notations) {
  const first = sequence[0];
  const points = [first.from === "bar" ? "bar" : String(first.from + 1)];
  sequence.forEach((move) => points.push(move.to === "off" ? "off" : String(move.to + 1)));
  const hit = notations.some((notation) => notation.endsWith("*"));
  return `${points.join("/")}${hit ? "*" : ""}`;
}

function showMoveTrace(move, notation) {
  if (!els.moveOverlay || !els.movePath || !els.moveGhost || !els.moveOverlay.getBoundingClientRect) return;

  const boardRect = els.moveOverlay.getBoundingClientRect();
  const from = getMoveAnchor(move.from, move.player, boardRect);
  const to = getMoveAnchor(move.to, move.player, boardRect);
  if (!from || !to) return;

  const lift = Math.max(46, Math.abs(to.x - from.x) * 0.18);
  const controlY = Math.min(from.y, to.y) - lift;
  const path = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${controlY} ${to.x} ${to.y}`;

  els.moveOverlay.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
  els.moveOverlay.classList.add("active");
  els.movePath.setAttribute("d", path);
  els.movePath.setAttribute("aria-label", notation);

  els.moveGhost.className = `move-ghost ${move.player} active`;
  els.moveGhost.style.setProperty("--from-x", `${from.x}px`);
  els.moveGhost.style.setProperty("--from-y", `${from.y}px`);
  els.moveGhost.style.setProperty("--mid-x", `${(from.x + to.x) / 2}px`);
  els.moveGhost.style.setProperty("--mid-y", `${controlY}px`);
  els.moveGhost.style.setProperty("--to-x", `${to.x}px`);
  els.moveGhost.style.setProperty("--to-y", `${to.y}px`);

  if (state.traceTimerId) window.clearTimeout(state.traceTimerId);
  state.traceTimerId = window.setTimeout(clearMoveTrace, 2200);
}

function clearMoveTrace() {
  if (state.traceTimerId) window.clearTimeout(state.traceTimerId);
  state.traceTimerId = null;
  if (els.moveOverlay) els.moveOverlay.classList.remove("active");
  if (els.moveGhost) els.moveGhost.className = "move-ghost";
}

function getMoveAnchor(target, playerKey, boardRect) {
  let node = null;
  if (target === "bar") {
    node = playerKey === "light" ? els.barLight : els.barDark;
  } else if (target === "off") {
    node = playerKey === "light" ? els.bearOffLight : els.bearOffDark;
  } else {
    node = findPointNode(target);
  }
  if (!node || !node.getBoundingClientRect) return null;
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left - boardRect.left + rect.width / 2,
    y: rect.top - boardRect.top + rect.height / 2,
  };
}

function findPointNode(point) {
  return [...document.querySelectorAll(".point")].find((node) => Number(node.dataset.point) === point);
}

function sourceFromPoint(point) {
  const owner = ownerOf(state.points[point]);
  if (!owner) return null;
  return { player: owner, count: Math.abs(state.points[point]) };
}

function predictBlockedTarget(point) {
  const opponent = state.turn === "light" ? "dark" : "light";
  return ownerOf(state.points[point]) === opponent && Math.abs(state.points[point]) > 1;
}

function pushHistory() {
  state.history.push(cloneSnapshot(state));
}

function cloneSnapshot(source) {
  return {
    points: [...source.points],
    bar: { ...source.bar },
    off: { ...source.off },
    turn: source.turn,
    dice: [...source.dice],
    remainingDice: [...source.remainingDice],
    selected: source.selected,
    moveCount: source.moveCount,
    seconds: source.seconds,
    started: source.started,
    message: source.message,
    gameOver: source.gameOver,
    opponent: source.opponent,
    difficulty: source.difficulty,
    npcThinking: source.npcThinking,
    npcTimerId: null,
    moveLog: source.moveLog.map((entry) => ({ ...entry })),
    traceTimerId: null,
  };
}

function restoreSnapshot(snapshot) {
  state.points = [...snapshot.points];
  state.bar = { ...snapshot.bar };
  state.off = { ...snapshot.off };
  state.turn = snapshot.turn;
  state.dice = [...snapshot.dice];
  state.remainingDice = [...snapshot.remainingDice];
  state.selected = snapshot.selected;
  state.moveCount = snapshot.moveCount;
  state.seconds = snapshot.seconds;
  state.started = snapshot.started;
  state.message = "Zurückgenommen.";
  state.gameOver = snapshot.gameOver;
  state.opponent = snapshot.opponent;
  state.difficulty = snapshot.difficulty;
  state.npcThinking = false;
  state.npcTimerId = null;
  state.moveLog = snapshot.moveLog.map((entry) => ({ ...entry }));
  clearMoveTrace();

  if (state.started && !state.timerId) startTimer();
  if (!state.started) stopTimer();
}

function removeDie(die) {
  state.remainingDice = removeDieFromList(state.remainingDice, die);
}

function removeDieFromList(list, die) {
  const copy = [...list];
  const index = copy.indexOf(die);
  if (index >= 0) copy.splice(index, 1);
  return copy;
}

function uniqueDice(dice) {
  return [...new Set(dice)].sort((a, b) => b - a);
}

function uniqueMoves(moves) {
  const byKey = new Map();
  moves.forEach((move) => {
    const key = `${sourceKey(move.from)}:${targetKey(move.to)}:${move.die}`;
    if (!byKey.has(key)) byKey.set(key, move);
  });
  return [...byKey.values()];
}

function currentPlayer() {
  return PLAYERS[state.turn];
}

function ownerOf(value) {
  if (value > 0) return "dark";
  if (value < 0) return "light";
  return null;
}

function sourceKey(source) {
  return source === "bar" ? "bar" : `p-${source}`;
}

function targetKey(target) {
  return target === "off" ? "off" : `p-${target}`;
}

function sameSource(a, b) {
  if (a === b) return true;
  return Number(a) === Number(b) && a !== null && b !== null;
}

function describePoint(point, owner, count) {
  const base = `Punkt ${point + 1}`;
  if (!owner || count === 0) return `${base}, leer`;
  return `${base}, ${count} ${PLAYERS[owner].name} Steine`;
}

function formatDice(dice) {
  return dice.join(" / ");
}

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function flash(message) {
  state.message = message;
  render();
}

function startTimer() {
  if (state.timerId) return;
  state.started = true;
  state.timerId = window.setInterval(() => {
    state.seconds += 1;
    els.timer.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
  state.started = false;
}

function formatTime(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
