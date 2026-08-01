const simplex = document.querySelector("#belief-simplex");
const point = document.querySelector("#belief-point");
const halo = document.querySelector("#belief-halo");
const trace = document.querySelector("#belief-trace");

function updateBelief(event) {
  const bounds = simplex.getBoundingClientRect();
  const rawX = ((event.clientX - bounds.left) / bounds.width) * 620;
  const rawY = ((event.clientY - bounds.top) / bounds.height) * 430;
  const y = Math.max(48, Math.min(370, rawY));
  const spread = ((y - 48) / 322) * 230;
  const x = Math.max(310 - spread, Math.min(310 + spread, rawX));

  point.setAttribute("cx", x);
  point.setAttribute("cy", y);
  halo.setAttribute("cx", x);
  halo.setAttribute("cy", y);
  trace.setAttribute("x2", x);
  trace.setAttribute("y2", y);
}

simplex.addEventListener("pointermove", updateBelief);
simplex.addEventListener("pointerdown", updateBelief);
