const ATR_PER_KG_SUGAR_EXPORT = 1.0453;
const ATR_PER_KG_SUGAR_DOMESTIC = 1.0495;
const ATR_PER_L_ANHYDROUS = 1.7651;
const ATR_PER_L_HYDROUS = 1.6913;
const USD_PER_TONNE_PER_CENT = 22.0462;

const SB_OCT26 = 14.74;
const HYDROUS_BRL_L = 2.0764;
const ANHYDROUS_BRL_L = 2.3786;
const USDBRL = 5.0754;
const ATR_PER_TONNE_CANE = 138.7;

const POL_PREMIUM = 0.40;
const LOGISTICS_USD_T = 42;

const VERTICES = {
  sugar: { x: 300, y: 48 },
  anhydrous: { x: 64, y: 360 },
  hydrous: { x: 536, y: 360 }
};

const simplex = document.querySelector("#atr-simplex");
const point = document.querySelector("#simplex-point");
const sugarOutput = document.querySelector("#weight-sugar");
const anhydrousOutput = document.querySelector("#weight-anhydrous");
const hydrousOutput = document.querySelector("#weight-hydrous");
const parityOutput = document.querySelector("#parity-price");
const blendedOutput = document.querySelector("#blended-return");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const AUTO_WEIGHTS = [
  { sugar: 1 / 3, anhydrous: 1 / 3, hydrous: 1 / 3 },
  { sugar: 0.72, anhydrous: 0.14, hydrous: 0.14 },
  { sugar: 0.14, anhydrous: 0.72, hydrous: 0.14 },
  { sugar: 0.14, anhydrous: 0.14, hydrous: 0.72 }
];
const AUTO_SEGMENT_MS = 8000;
const AUTO_RESUME_MS = 4000;

let animationFrame = 0;
let animationStart = 0;
let resumeTimer = 0;

function sugarATR(price, fx, polPremium, logistics) {
  const fobUSD = (price + polPremium) * USD_PER_TONNE_PER_CENT;
  const netBRLPerKg = ((fobUSD - logistics) * fx) / 1000;
  return netBRLPerKg / ATR_PER_KG_SUGAR_EXPORT;
}

function sugarPriceFromATR(value) {
  const netUSDPerTonne = (value * ATR_PER_KG_SUGAR_EXPORT * 1000) / USDBRL;
  return ((netUSDPerTonne + LOGISTICS_USD_T) / USD_PER_TONNE_PER_CENT) - POL_PREMIUM;
}

const SUGAR_BRL_ATR = sugarATR(SB_OCT26, USDBRL, POL_PREMIUM, LOGISTICS_USD_T);
const ANHYDROUS_BRL_ATR = ANHYDROUS_BRL_L / ATR_PER_L_ANHYDROUS;
const HYDROUS_BRL_ATR = HYDROUS_BRL_L / ATR_PER_L_HYDROUS;

function barycentric(position) {
  const a = VERTICES.sugar;
  const b = VERTICES.anhydrous;
  const c = VERTICES.hydrous;
  const denominator = ((b.y - c.y) * (a.x - c.x)) + ((c.x - b.x) * (a.y - c.y));
  const sugar = (((b.y - c.y) * (position.x - c.x)) + ((c.x - b.x) * (position.y - c.y))) / denominator;
  const anhydrous = (((c.y - a.y) * (position.x - c.x)) + ((a.x - c.x) * (position.y - c.y))) / denominator;
  return { sugar, anhydrous, hydrous: 1 - sugar - anhydrous };
}

function cartesian(weights) {
  return {
    x: (weights.sugar * VERTICES.sugar.x) + (weights.anhydrous * VERTICES.anhydrous.x) + (weights.hydrous * VERTICES.hydrous.x),
    y: (weights.sugar * VERTICES.sugar.y) + (weights.anhydrous * VERTICES.anhydrous.y) + (weights.hydrous * VERTICES.hydrous.y)
  };
}

function closestPointOnSegment(position, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  const projection = (((position.x - start.x) * dx) + ((position.y - start.y) * dy)) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return { x: start.x + (t * dx), y: start.y + (t * dy) };
}

function squaredDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return (dx * dx) + (dy * dy);
}

function clampToTriangle(position) {
  const weights = barycentric(position);
  if (weights.sugar >= 0 && weights.anhydrous >= 0 && weights.hydrous >= 0) {
    return position;
  }

  const edges = [
    [VERTICES.sugar, VERTICES.anhydrous],
    [VERTICES.anhydrous, VERTICES.hydrous],
    [VERTICES.hydrous, VERTICES.sugar]
  ];

  let closest = closestPointOnSegment(position, edges[0][0], edges[0][1]);
  let shortestDistance = squaredDistance(position, closest);

  for (const [start, end] of edges.slice(1)) {
    const candidate = closestPointOnSegment(position, start, end);
    const distance = squaredDistance(position, candidate);
    if (distance < shortestDistance) {
      closest = candidate;
      shortestDistance = distance;
    }
  }

  return closest;
}

function normalizedWeights(position) {
  const raw = barycentric(position);
  const sugar = Math.max(0, raw.sugar);
  const anhydrous = Math.max(0, raw.anhydrous);
  const hydrous = Math.max(0, raw.hydrous);
  const total = sugar + anhydrous + hydrous;
  return {
    sugar: sugar / total,
    anhydrous: anhydrous / total,
    hydrous: hydrous / total
  };
}

function display(position) {
  const clamped = clampToTriangle(position);
  const weights = normalizedWeights(clamped);
  const blended = (weights.sugar * SUGAR_BRL_ATR) + (weights.anhydrous * ANHYDROUS_BRL_ATR) + (weights.hydrous * HYDROUS_BRL_ATR);
  const parity = sugarPriceFromATR(blended);
  const perTonneCane = blended * ATR_PER_TONNE_CANE;

  point.setAttribute("cx", clamped.x.toFixed(2));
  point.setAttribute("cy", clamped.y.toFixed(2));
  sugarOutput.value = `${(weights.sugar * 100).toFixed(1)}%`;
  anhydrousOutput.value = `${(weights.anhydrous * 100).toFixed(1)}%`;
  hydrousOutput.value = `${(weights.hydrous * 100).toFixed(1)}%`;
  parityOutput.value = `${parity.toFixed(2)} c/lb`;
  blendedOutput.value = `R$${blended.toFixed(4)}/kg ATR · R$${perTonneCane.toFixed(2)}/t cane`;

  simplex.dataset.x = clamped.x.toFixed(2);
  simplex.dataset.y = clamped.y.toFixed(2);
}

function pointerPosition(event) {
  const svgPoint = simplex.createSVGPoint();
  svgPoint.x = event.clientX;
  svgPoint.y = event.clientY;
  return svgPoint.matrixTransform(simplex.getScreenCTM().inverse());
}

function interpolateWeights(start, end, amount) {
  const eased = amount * amount * (3 - (2 * amount));
  return {
    sugar: start.sugar + ((end.sugar - start.sugar) * eased),
    anhydrous: start.anhydrous + ((end.anhydrous - start.anhydrous) * eased),
    hydrous: start.hydrous + ((end.hydrous - start.hydrous) * eased)
  };
}

function animateSimplex(timestamp) {
  if (reducedMotion.matches) {
    return;
  }

  if (!animationStart) {
    animationStart = timestamp;
  }

  const elapsed = timestamp - animationStart;
  const segment = Math.floor(elapsed / AUTO_SEGMENT_MS) % AUTO_WEIGHTS.length;
  const nextSegment = (segment + 1) % AUTO_WEIGHTS.length;
  const progress = (elapsed % AUTO_SEGMENT_MS) / AUTO_SEGMENT_MS;
  const weights = interpolateWeights(AUTO_WEIGHTS[segment], AUTO_WEIGHTS[nextSegment], progress);
  display(cartesian(weights));
  animationFrame = window.requestAnimationFrame(animateSimplex);
}

function stopAutoMotion() {
  window.cancelAnimationFrame(animationFrame);
  window.clearTimeout(resumeTimer);
  animationFrame = 0;
  animationStart = 0;
}

function startAutoMotion() {
  stopAutoMotion();
  if (!reducedMotion.matches) {
    animationFrame = window.requestAnimationFrame(animateSimplex);
  }
}

function resumeAutoMotionLater() {
  window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(startAutoMotion, AUTO_RESUME_MS);
}

function updateFromPointer(event) {
  display(pointerPosition(event));
}

simplex.addEventListener("pointerdown", (event) => {
  stopAutoMotion();
  simplex.setPointerCapture(event.pointerId);
  updateFromPointer(event);
});

simplex.addEventListener("pointermove", (event) => {
  if (simplex.hasPointerCapture(event.pointerId)) {
    updateFromPointer(event);
  }
});

simplex.addEventListener("pointerup", (event) => {
  if (simplex.hasPointerCapture(event.pointerId)) {
    simplex.releasePointerCapture(event.pointerId);
  }
  resumeAutoMotionLater();
});

simplex.addEventListener("pointercancel", resumeAutoMotionLater);

simplex.addEventListener("keydown", (event) => {
  const movement = {
    ArrowLeft: { x: -8, y: 0 },
    ArrowRight: { x: 8, y: 0 },
    ArrowUp: { x: 0, y: -8 },
    ArrowDown: { x: 0, y: 8 }
  }[event.key];

  if (!movement) {
    return;
  }

  event.preventDefault();
  stopAutoMotion();
  const current = {
    x: Number(simplex.dataset.x || 300),
    y: Number(simplex.dataset.y || 256)
  };
  display({ x: current.x + movement.x, y: current.y + movement.y });
  resumeAutoMotionLater();
});

display(cartesian({ sugar: 1 / 3, anhydrous: 1 / 3, hydrous: 1 / 3 }));
startAutoMotion();

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    stopAutoMotion();
  } else {
    startAutoMotion();
  }
});

const NIM_POSITIONS = [[3, 4, 5], [2, 4, 7], [1, 5, 7], [3, 6, 7]];
const nimBoard = document.querySelector("#nim-board");
const nimScore = document.querySelector("#nim-score");
const nimStatus = document.querySelector("#nim-status");
const nimTake = document.querySelector("#nim-take");
const nimNew = document.querySelector("#nim-new");
const nimExplanation = document.querySelector("#nim-explanation");
const nimProof = document.querySelector("#nim-proof");
let nimPositionIndex = 0;
let nimHeaps = [...NIM_POSITIONS[nimPositionIndex]];
let nimInitialHeaps = [...nimHeaps];
let nimSelection = null;
let nimGameOver = false;
let nimWins = 0;
let opponentWins = 0;

function nimSum(heaps) {
  return heaps.reduce((sum, heap) => sum ^ heap, 0);
}

function winningNimMove(heaps) {
  const sum = nimSum(heaps);
  if (sum !== 0) {
    for (let pile = 0; pile < heaps.length; pile += 1) {
      const target = heaps[pile] ^ sum;
      if (target < heaps[pile]) {
        return { pile, take: heaps[pile] - target };
      }
    }
  }
  const pile = heaps.findIndex((heap) => heap > 0);
  return { pile, take: 1 };
}

function renderNim() {
  nimBoard.replaceChildren();
  nimHeaps.forEach((heap, pileIndex) => {
    const pile = document.createElement("div");
    pile.className = "nim-pile";
    const label = document.createElement("p");
    label.className = "nim-pile-label";
    label.textContent = `Pile ${pileIndex + 1} · ${heap}`;
    const stones = document.createElement("div");
    stones.className = "nim-stones";

    for (let stoneIndex = 0; stoneIndex < heap; stoneIndex += 1) {
      const take = heap - stoneIndex;
      const stone = document.createElement("button");
      stone.type = "button";
      stone.className = "nim-stone";
      stone.setAttribute("aria-label", `Take ${take} from pile ${pileIndex + 1}`);
      const selected = nimSelection && nimSelection.pile === pileIndex && stoneIndex >= heap - nimSelection.take;
      stone.classList.toggle("is-selected", Boolean(selected));
      stone.setAttribute("aria-pressed", String(Boolean(selected)));
      stone.disabled = nimGameOver;
      stone.addEventListener("click", () => {
        nimSelection = { pile: pileIndex, take };
        nimTake.disabled = false;
        nimStatus.textContent = `Take ${take} from pile ${pileIndex + 1}?`;
        renderNim();
      });
      stones.append(stone);
    }
    pile.append(label, stones);
    nimBoard.append(pile);
  });
}

function endNimGame(winner) {
  nimGameOver = true;
  nimTake.disabled = true;
  if (winner === "you") {
    nimWins += 1;
    nimStatus.textContent = "You won.";
  } else {
    opponentWins += 1;
    nimStatus.textContent = "The opponent won.";
  }
  nimScore.value = `You ${nimWins} · Opponent ${opponentWins}`;
  const move = winningNimMove(nimInitialHeaps);
  const target = nimInitialHeaps[move.pile] - move.take;
  const zeroPosition = [...nimInitialHeaps];
  zeroPosition[move.pile] = target;
  const width = Math.max(...nimInitialHeaps).toString(2).length;
  const binary = zeroPosition.map((heap) => heap.toString(2).padStart(width, "0")).join(" ⊕ ");
  nimProof.className = "nim-proof";
  nimProof.replaceChildren();
  const explanation = document.createElement("p");
  explanation.textContent = `The winning first move was pile ${move.pile + 1}: ${nimInitialHeaps[move.pile]} → ${target}.`;
  const equation = document.createElement("p");
  equation.className = "nim-binary";
  equation.textContent = `${binary} = 0`;
  const rule = document.createElement("p");
  rule.textContent = "A zero nim-sum leaves no winning reply against perfect play.";
  nimProof.append(explanation, equation, rule);
  nimExplanation.hidden = false;
  renderNim();
}

function opponentNimMove() {
  const move = winningNimMove(nimHeaps);
  nimHeaps[move.pile] -= move.take;
  if (nimHeaps.every((heap) => heap === 0)) {
    endNimGame("opponent");
    return;
  }
  nimStatus.textContent = `Opponent took ${move.take} from pile ${move.pile + 1}. Your turn.`;
  renderNim();
}

nimTake.addEventListener("click", () => {
  if (!nimSelection || nimGameOver) {
    return;
  }
  nimHeaps[nimSelection.pile] -= nimSelection.take;
  nimSelection = null;
  nimTake.disabled = true;
  if (nimHeaps.every((heap) => heap === 0)) {
    endNimGame("you");
    return;
  }
  opponentNimMove();
});

nimNew.addEventListener("click", () => {
  nimPositionIndex = (nimPositionIndex + 1) % NIM_POSITIONS.length;
  nimHeaps = [...NIM_POSITIONS[nimPositionIndex]];
  nimInitialHeaps = [...nimHeaps];
  nimSelection = null;
  nimGameOver = false;
  nimTake.disabled = true;
  nimExplanation.hidden = true;
  nimExplanation.open = false;
  nimStatus.textContent = "You move first. Take any number of stones from one pile.";
  renderNim();
});

renderNim();

const PUZZLE_198 = "..9.....3.1..7.......5.86...4......7.2.....9.5......8...63.5.......9..1.8.....2..";
const sudokuGrid = document.querySelector("#sudoku-grid");
const sudokuResult = document.querySelector("#sudoku-result");
const sudokuReset = document.querySelector("#sudoku-reset");
let selectedSudokuCell = null;

function updateSudokuStatus() {
  const entries = sudokuGrid.querySelectorAll(".is-entry").length;
  sudokuResult.value = entries === 0 ? "20 clues" : `${entries} / 61 filled`;
  sudokuReset.hidden = entries === 0;
}

function selectSudokuCell(cell) {
  selectedSudokuCell?.classList.remove("is-selected");
  selectedSudokuCell = cell;
  cell.classList.add("is-selected");
  cell.focus();
}

function enterSudokuValue(cell, value) {
  if (/^[1-9]$/.test(value)) {
    cell.textContent = value;
    cell.classList.add("is-entry");
    cell.setAttribute("aria-label", `Row ${cell.dataset.row}, column ${cell.dataset.column}, entered ${value}`);
  } else if (value === "Backspace" || value === "Delete") {
    cell.textContent = "";
    cell.classList.remove("is-entry");
    cell.setAttribute("aria-label", `Row ${cell.dataset.row}, column ${cell.dataset.column}, empty`);
  }
  updateSudokuStatus();
}

Array.from(PUZZLE_198).forEach((value, index) => {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const given = value !== ".";
  const cell = document.createElement(given ? "div" : "button");
  cell.className = `sudoku-cell${given ? " is-given" : ""}`;
  cell.dataset.row = String(row);
  cell.dataset.column = String(column);
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", given ? `Row ${row}, column ${column}, given ${value}` : `Row ${row}, column ${column}, empty`);
  cell.textContent = given ? value : "";
  if (!given) {
    cell.type = "button";
    cell.addEventListener("click", () => selectSudokuCell(cell));
    cell.addEventListener("keydown", (event) => {
      if (/^[1-9]$/.test(event.key) || event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        enterSudokuValue(cell, event.key);
      }
    });
  }
  sudokuGrid.append(cell);
});

sudokuReset.addEventListener("click", () => {
  sudokuGrid.querySelectorAll("button.sudoku-cell").forEach((cell) => {
    cell.textContent = "";
    cell.classList.remove("is-entry", "is-selected");
    cell.setAttribute("aria-label", `Row ${cell.dataset.row}, column ${cell.dataset.column}, empty`);
  });
  selectedSudokuCell = null;
  updateSudokuStatus();
});

updateSudokuStatus();

void ATR_PER_KG_SUGAR_DOMESTIC;
