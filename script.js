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

const pathGrid = document.querySelector("#path-grid");
const pathCount = document.querySelector("#path-count");
const GRID_SIZE = 6;
let blockedPathNode = null;

function countLatticePaths(blocked) {
  const counts = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  counts[0][0] = 1;
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (blocked && blocked.row === row && blocked.column === column) {
        counts[row][column] = 0;
        continue;
      }
      if (row === 0 && column === 0) {
        continue;
      }
      counts[row][column] = (row > 0 ? counts[row - 1][column] : 0) + (column > 0 ? counts[row][column - 1] : 0);
    }
  }
  return counts[GRID_SIZE - 1][GRID_SIZE - 1];
}

function updatePathGrid() {
  pathCount.value = `${countLatticePaths(blockedPathNode)} paths`;
  pathGrid.querySelectorAll(".path-node").forEach((node) => {
    const isBlocked = blockedPathNode && Number(node.dataset.row) === blockedPathNode.row && Number(node.dataset.column) === blockedPathNode.column;
    node.classList.toggle("is-blocked", Boolean(isBlocked));
    node.setAttribute("aria-pressed", String(Boolean(isBlocked)));
  });
}

for (let row = 0; row < GRID_SIZE; row += 1) {
  for (let column = 0; column < GRID_SIZE; column += 1) {
    const node = document.createElement("button");
    const endpoint = (row === 0 && column === 0) || (row === GRID_SIZE - 1 && column === GRID_SIZE - 1);
    node.type = "button";
    node.className = `path-node${endpoint ? " is-endpoint" : ""}`;
    node.dataset.row = String(row);
    node.dataset.column = String(column);
    node.setAttribute("role", "gridcell");
    node.setAttribute("aria-label", endpoint ? (row === 0 ? "Start" : "Finish") : `Point ${row + 1}, ${column + 1}`);
    node.disabled = endpoint;
    if (!endpoint) {
      node.addEventListener("click", () => {
        const selected = { row, column };
        blockedPathNode = blockedPathNode && blockedPathNode.row === row && blockedPathNode.column === column ? null : selected;
        updatePathGrid();
      });
    }
    pathGrid.append(node);
  }
}

updatePathGrid();

const pairCells = document.querySelectorAll(".pair-cell");
const removableCandidates = document.querySelectorAll("[data-remove]");
const sudokuResult = document.querySelector("#sudoku-result");
const sudokuReset = document.querySelector("#sudoku-reset");

function applyNakedPair() {
  removableCandidates.forEach((candidate) => candidate.classList.add("is-removed"));
  const solvedCell = document.querySelector('[data-candidates="2,5"]');
  solvedCell.classList.add("is-single");
  sudokuResult.value = "4 removed · 1 single";
  sudokuReset.hidden = false;
}

function resetSudoku() {
  removableCandidates.forEach((candidate) => candidate.classList.remove("is-removed"));
  document.querySelector('[data-candidates="2,5"]').classList.remove("is-single");
  sudokuResult.value = "2 · 7 appears twice";
  sudokuReset.hidden = true;
}

pairCells.forEach((cell) => cell.addEventListener("click", applyNakedPair));
sudokuReset.addEventListener("click", resetSudoku);

void ATR_PER_KG_SUGAR_DOMESTIC;
