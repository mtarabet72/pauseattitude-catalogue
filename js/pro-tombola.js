// pro-tombola.js — Espace Pro : la roue de la tombola et son historique.
// Les lots se gèrent dans un écran séparé (pro-lots.js), les points de
// fidélité dans un autre (pro-fidelite.js).

const WHEEL_COLORS = ["#3C8A3E", "#D64545", "#F2C14E", "#B9793F", "#4A4785", "#3F7EA6", "#D9603B", "#2C6B2E"];
const TOMBOLA_POINTS_PAR_TICKET = 100;

function tombolaTicketsFor(points) {
  return Math.floor((points || 0) / TOMBOLA_POINTS_PAR_TICKET);
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const ProTombolaView = (() => {
  let viewRef = null;
  let currentRotation = 0;

  async function render(view) {
    viewRef = view;
    await draw();
  }

  async function draw() {
    const view = viewRef;
    const [clients, tirages, lots] = await Promise.all([
      DB.getAll(DB.STORES.clients),
      DB.getAll(DB.STORES.tirages),
      DB.getAll(DB.STORES.lots),
    ]);
    tirages.sort((a, b) => new Date(b.date) - new Date(a.date));

    const eligibles = clients.filter((c) => tombolaTicketsFor(c.points) >= 1);
    const lotsDisponibles = lots.filter((l) => (l.quantite || 0) > 0);

    view.innerHTML = `
      <div class="pro-card" style="margin-bottom:20px">
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0">
          ${eligibles.length} client${eligibles.length > 1 ? "s" : ""} éligible${eligibles.length > 1 ? "s" : ""}
          (≥ 1 ticket) — ${eligibles.reduce((s, c) => s + tombolaTicketsFor(c.points), 0)} tickets au total —
          ${lotsDisponibles.length} lot${lotsDisponibles.length > 1 ? "s" : ""} en stock.
          Gérez les lots dans <a href="#/lots" style="color:var(--leaf-dark)">Lots</a>.
        </p>
      </div>

      <div class="pro-card" style="margin-bottom:20px">
        ${
          lotsDisponibles.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft);margin:0">Ajoutez au moins un lot en stock dans l'écran <a href="#/lots" style="color:var(--leaf-dark)">Lots</a> pour activer la roue.</p>`
            : `
            <div style="display:flex;flex-direction:column;align-items:center;gap:18px">
              <div style="position:relative;width:260px;height:260px">
                <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:2;font-size:26px;line-height:1">🔻</div>
                <div id="wheel-rotor" style="width:260px;height:260px;transition:transform 4s cubic-bezier(.15,.65,.15,1);transform:rotate(${currentRotation}deg)">
                  ${wheelSVG(lotsDisponibles)}
                </div>
              </div>
              <button class="pro-btn pro-btn-primary" id="btn-tirer" ${eligibles.length === 0 ? "disabled" : ""} style="font-size:15px;padding:12px 26px">🎡 Lancer la roue</button>
              ${eligibles.length === 0 ? `<p style="font-size:12px;color:var(--ink-soft);margin:0">Aucun client n'a encore de ticket (100 points).</p>` : ""}
            </div>
            <div id="tombola-result" style="margin-top:18px"></div>
          `
        }
      </div>

      <div class="pro-card" id="historique-card">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:10px">Historique des tirages</h3>
        ${historiqueTableHTML(tirages)}
      </div>
    `;

    view.querySelector("#btn-tirer")?.addEventListener("click", () => spinWheel(eligibles, lotsDisponibles));
  }

  function wheelSVG(lots) {
    const n = lots.length;
    const segAngle = 360 / n;
    const cx = 130, cy = 130, R = 128;

    const wedges = lots
      .map((lot, i) => {
        const a1 = i * segAngle;
        const a2 = (i + 1) * segAngle;
        const p1 = polarPoint(cx, cy, R, a1);
        const p2 = polarPoint(cx, cy, R, a2);
        const largeArc = segAngle > 180 ? 1 : 0;
        const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
        const mid = (a1 + a2) / 2;
        const imgPos = polarPoint(cx, cy, R * 0.62, mid);
        const imgSize = Math.min(46, (segAngle / 360) * R * 2.1);
        const image = lot.image
          ? `<image href="${lot.image}" x="${imgPos.x - imgSize / 2}" y="${imgPos.y - imgSize / 2}" width="${imgSize}" height="${imgSize}" clip-path="circle(${imgSize / 2}px at ${imgSize / 2}px ${imgSize / 2}px)" />`
          : "";
        return `
          <path d="M${cx},${cy} L${p1.x},${p1.y} A${R},${R} 0 ${largeArc} 1 ${p2.x},${p2.y} Z" fill="${color}" stroke="#fff" stroke-width="2" />
          ${image}
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 260 260" width="260" height="260">
        ${wedges}
        <circle cx="${cx}" cy="${cy}" r="20" fill="#fff" stroke="var(--ink)" stroke-width="2" />
      </svg>
    `;
  }

  function historiqueTableHTML(tirages) {
    if (tirages.length === 0) {
      return `<p style="font-size:13px;color:var(--ink-soft);margin:0">Aucun tirage effectué pour l'instant.</p>`;
    }
    return `
      <table class="pro-table">
        <thead><tr><th>Date</th><th>Gagnant</th><th>Lot</th></tr></thead>
        <tbody>
          ${tirages.map((t) => `<tr><td>${new Date(t.date).toLocaleString("fr-FR")}</td><td>${escapeHtml(t.gagnant)}</td><td>${escapeHtml(t.lot || "—")}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  // Choisit un lot selon le % de chance saisi dans l'écran Lots (roue toujours à portions égales)
  function pickWeightedLot(lots) {
    const total = lots.reduce((s, l) => s + (l.chance || 1), 0) || 1;
    let r = Math.random() * total;
    for (let i = 0; i < lots.length; i++) {
      r -= lots[i].chance || 1;
      if (r <= 0) return i;
    }
    return lots.length - 1;
  }

  async function spinWheel(eligibles, lotsDisponibles) {
    const view = viewRef;
    const rotor = view.querySelector("#wheel-rotor");
    const n = lotsDisponibles.length;
    const segAngle = 360 / n;

    const winningIndex = pickWeightedLot(lotsDisponibles);
    const lot = lotsDisponibles[winningIndex];
    const mid = winningIndex * segAngle + segAngle / 2;
    const jitter = (Math.random() - 0.5) * segAngle * 0.6;

    const needed = ((360 - mid + jitter) % 360 + 360) % 360;
    currentRotation += 5 * 360 + needed - (currentRotation % 360);

    view.querySelector("#btn-tirer").disabled = true;
    const resultEl = view.querySelector("#tombola-result");
    resultEl.innerHTML = `<p style="font-size:13.5px;color:var(--ink-soft);text-align:center">La roue tourne…</p>`;

    rotor.style.transform = `rotate(${currentRotation}deg)`;

    await new Promise((resolve) => {
      const onEnd = () => {
        rotor.removeEventListener("transitionend", onEnd);
        resolve();
      };
      rotor.addEventListener("transitionend", onEnd);
    });

    const pool = [];
    eligibles.forEach((c) => {
      for (let i = 0; i < tombolaTicketsFor(c.points); i++) pool.push(c);
    });
    const winner = pool[Math.floor(Math.random() * pool.length)];

    winner.points = Math.max(0, (winner.points || 0) - TOMBOLA_POINTS_PAR_TICKET);
    await DB.put(DB.STORES.clients, winner);

    const tirageRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      gagnant: winner.nom,
      gagnantId: winner.id,
      lot: lot.nom,
      lotId: lot.id,
    };
    await DB.put(DB.STORES.tirages, tirageRecord);

    lot.quantite = Math.max(0, (lot.quantite || 0) - 1);
    await DB.put(DB.STORES.lots, lot);

    resultEl.innerHTML = `
      <div style="background:var(--paper);border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:12.5px;color:var(--ink-soft)">🎉 La roue s'arrête sur</div>
        <div style="font-family:var(--font-display);font-size:22px;color:var(--tomato);margin-top:4px">${escapeHtml(lot.nom)}</div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px">Gagné par</div>
        <div style="font-family:var(--font-heading);font-weight:600;font-size:17px">${escapeHtml(winner.nom)}</div>
        <div style="font-size:11.5px;color:var(--ink-soft);margin-top:8px">-${TOMBOLA_POINTS_PAR_TICKET} points déduits (ticket utilisé) — il lui reste ${winner.points} points</div>
      </div>
    `;

    const tirages = await DB.getAll(DB.STORES.tirages);
    tirages.sort((a, b) => new Date(b.date) - new Date(a.date));
    document.getElementById("historique-card").innerHTML = `
      <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:10px">Historique des tirages</h3>
      ${historiqueTableHTML(tirages)}
    `;
  }

  return { render };
})();

window.ProTombolaView = ProTombolaView;
