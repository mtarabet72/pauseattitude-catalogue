// pro-fidelite.js — Espace Pro : points de fidélité, gestion des lots
// (avec image) et tombola sous forme de roue tournante pondérée par stock.

const POINTS_PAR_TICKET = 100;
const WHEEL_COLORS = ["#3C8A3E", "#D64545", "#F2C14E", "#B9793F", "#4A4785", "#3F7EA6", "#D9603B", "#2C6B2E"];

function ticketsFor(points) {
  return Math.floor((points || 0) / POINTS_PAR_TICKET);
}

function blankLot() {
  return { id: crypto.randomUUID(), nom: "", quantite: 1, image: "", poids: 1 };
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function resizeImageToDataURL(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const ProFideliteView = (() => {
  let viewRef = null;
  let currentRotation = 0;
  let pendingLotImage = "";

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
    clients.sort((a, b) => (b.points || 0) - (a.points || 0));
    tirages.sort((a, b) => new Date(b.date) - new Date(a.date));
    lots.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

    const eligibles = clients.filter((c) => ticketsFor(c.points) >= 1);
    const lotsDisponibles = lots.filter((l) => (l.quantite || 0) > 0);

    view.innerHTML = `
      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Points de fidélité</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">${POINTS_PAR_TICKET} points = 1 ticket de tombola. Ajoutez des points après une commande.</p>
        ${
          clients.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft)">Aucun client. Créez d'abord des fiches clients dans l'onglet <a href="#/clients" style="color:var(--leaf-dark)">Clients &amp; tarifs</a>.</p>`
            : `<table class="pro-table">
                <thead><tr><th>Client</th><th>Points</th><th>Tickets</th><th></th></tr></thead>
                <tbody>${clients.map(clientRowTemplate).join("")}</tbody>
              </table>`
        }
      </div>

      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Lots disponibles</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">Ajoutez une image par lot — elle apparaîtra sur la roue. Un lot à 0 en stock disparaît de la roue.</p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
          <div id="lot-image-preview" style="width:44px;height:44px;border-radius:8px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:10px;color:var(--ink-soft);text-align:center">image</div>
          <label class="pro-btn" style="cursor:pointer;margin:0">
            📷 Image
            <input type="file" id="lot-image-input" accept="image/*" style="display:none" />
          </label>
          <input id="lot-nom" type="text" placeholder="Nom du lot (ex. Sandwich offert)" style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <input id="lot-qte" type="number" min="1" value="1" placeholder="Stock" style="width:80px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <input id="lot-poids" type="number" min="0.1" step="0.1" value="1" placeholder="Poids" title="Poids relatif : plus il est grand, plus le lot a de chances de sortir à la roue" style="width:80px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <button class="pro-btn pro-btn-primary" id="btn-add-lot">+ Ajouter</button>
        </div>
        <p style="font-size:11.5px;color:var(--ink-soft);margin:0 0 14px">Le <strong>poids</strong> définit la fraction de chances de gagner ce lot (indépendant du stock) — un lot à poids 2 a deux fois plus de chances qu'un lot à poids 1.</p>

        ${
          lots.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft);margin:0">Aucun lot enregistré.</p>`
            : `<table class="pro-table">
                <thead><tr><th></th><th>Lot</th><th>Stock restant</th><th>Fraction</th><th></th></tr></thead>
                <tbody>
                  ${lots
                    .map((l) => {
                      const totalPoids = lotsDisponibles.reduce((s, x) => s + (x.poids || 1), 0) || 1;
                      const pct = (l.quantite || 0) > 0 ? (((l.poids || 1) / totalPoids) * 100).toFixed(0) : "0";
                      return `
                    <tr>
                      <td>${l.image ? `<img src="${l.image}" style="width:32px;height:32px;object-fit:cover;border-radius:6px" />` : "—"}</td>
                      <td>${escapeHtml(l.nom)}</td>
                      <td style="font-family:var(--font-mono)" data-lot-stock="${l.id}">${l.quantite}</td>
                      <td style="font-family:var(--font-mono)">${pct}%</td>
                      <td style="text-align:right"><button class="pro-btn pro-btn-danger" data-del-lot="${l.id}">Supprimer</button></td>
                    </tr>
                  `;
                    })
                    .join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Roue de la tombola</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 16px">
          ${eligibles.length} client${eligibles.length > 1 ? "s" : ""} éligible${eligibles.length > 1 ? "s" : ""}
          (≥ 1 ticket) — ${eligibles.reduce((s, c) => s + ticketsFor(c.points), 0)} tickets au total.
        </p>

        ${
          lotsDisponibles.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft)">Ajoutez au moins un lot en stock pour activer la roue.</p>`
            : `
            <div style="display:flex;flex-direction:column;align-items:center;gap:18px">
              <div style="position:relative;width:260px;height:260px">
                <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:2;font-size:26px;line-height:1">🔻</div>
                <div id="wheel-rotor" style="width:260px;height:260px;transition:transform 4s cubic-bezier(.15,.65,.15,1);transform:rotate(${currentRotation}deg)">
                  ${wheelSVG(lotsDisponibles)}
                </div>
              </div>
              <button class="pro-btn pro-btn-primary" id="btn-tirer" ${eligibles.length === 0 ? "disabled" : ""} style="font-size:15px;padding:12px 26px">🎡 Lancer la roue</button>
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

    // --- Points ---
    view.querySelectorAll("[data-add-points]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.addPoints;
        const input = view.querySelector(`[data-points-input="${id}"]`);
        const amount = parseInt(input.value, 10);
        if (!amount || amount <= 0) return;
        const client = await DB.get(DB.STORES.clients, id);
        client.points = (client.points || 0) + amount;
        await DB.put(DB.STORES.clients, client);
        await draw();
      });
    });

    // --- Upload image du lot ---
    view.querySelector("#lot-image-input")?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingLotImage = await resizeImageToDataURL(file, 160);
      view.querySelector("#lot-image-preview").innerHTML = `<img src="${pendingLotImage}" style="width:100%;height:100%;object-fit:cover" />`;
    });

    // --- Ajout / suppression de lots ---
    view.querySelector("#btn-add-lot").addEventListener("click", async () => {
      const nom = view.querySelector("#lot-nom").value.trim();
      const qte = parseInt(view.querySelector("#lot-qte").value, 10);
      const poids = parseFloat(view.querySelector("#lot-poids").value) || 1;
      if (!nom || !qte || qte <= 0) return;
      await DB.put(DB.STORES.lots, { ...blankLot(), nom, quantite: qte, image: pendingLotImage, poids });
      pendingLotImage = "";
      await draw();
    });

    view.querySelectorAll("[data-del-lot]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("Supprimer ce lot ?")) {
          await DB.delete(DB.STORES.lots, btn.dataset.delLot);
          await draw();
        }
      });
    });

    view.querySelector("#btn-tirer")?.addEventListener("click", () => spinWheel(eligibles, lotsDisponibles));
  }

  // Calcule les bornes angulaires [début, fin] de chaque lot, proportionnelles à son poids
  function computeSegments(lots) {
    const total = lots.reduce((s, l) => s + (l.poids || 1), 0) || 1;
    let acc = 0;
    return lots.map((l) => {
      const span = ((l.poids || 1) / total) * 360;
      const seg = { a1: acc, a2: acc + span, lot: l };
      acc += span;
      return seg;
    });
  }

  function wheelSVG(lots) {
    const segments = computeSegments(lots);
    const cx = 130, cy = 130, R = 128;

    const wedges = segments
      .map((seg, i) => {
        const p1 = polarPoint(cx, cy, R, seg.a1);
        const p2 = polarPoint(cx, cy, R, seg.a2);
        const span = seg.a2 - seg.a1;
        const largeArc = span > 180 ? 1 : 0;
        const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
        const mid = (seg.a1 + seg.a2) / 2;
        const imgPos = polarPoint(cx, cy, R * 0.62, mid);
        const imgSize = Math.min(46, (span / 360) * R * 2.1);
        const image = seg.lot.image
          ? `<image href="${seg.lot.image}" x="${imgPos.x - imgSize / 2}" y="${imgPos.y - imgSize / 2}" width="${imgSize}" height="${imgSize}" clip-path="circle(${imgSize / 2}px at ${imgSize / 2}px ${imgSize / 2}px)" />`
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

  function clientRowTemplate(c) {
    const points = c.points || 0;
    const tickets = ticketsFor(points);
    return `
      <tr>
        <td>${escapeHtml(c.nom) || "(sans nom)"}</td>
        <td style="font-family:var(--font-mono)" data-client-points="${c.id}">${points}</td>
        <td data-client-tickets="${c.id}">${tickets > 0 ? `<span class="pro-badge">${tickets} 🎟️</span>` : "—"}</td>
        <td style="white-space:nowrap">
          <input type="number" min="1" placeholder="+ pts" data-points-input="${c.id}" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12.5px" />
          <button class="pro-btn" data-add-points="${c.id}" style="padding:6px 10px">Ajouter</button>
        </td>
      </tr>
    `;
  }

  // Choisit un lot pondéré par son poids/fraction (indépendant du stock restant)
  function pickWeightedLot(lots) {
    const total = lots.reduce((s, l) => s + (l.poids || 1), 0) || 1;
    let r = Math.random() * total;
    for (let i = 0; i < lots.length; i++) {
      r -= lots[i].poids || 1;
      if (r <= 0) return i;
    }
    return lots.length - 1;
  }

  async function spinWheel(eligibles, lotsDisponibles) {
    const view = viewRef;
    const rotor = view.querySelector("#wheel-rotor");

    const winningIndex = pickWeightedLot(lotsDisponibles);
    const lot = lotsDisponibles[winningIndex];
    const segments = computeSegments(lotsDisponibles);
    const seg = segments[winningIndex];
    const mid = (seg.a1 + seg.a2) / 2;
    const jitter = (Math.random() - 0.5) * (seg.a2 - seg.a1) * 0.6;

    // Rotation nécessaire pour amener le milieu du segment gagnant sous le repère (haut = 0°)
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
      for (let i = 0; i < ticketsFor(c.points); i++) pool.push(c);
    });
    const winner = pool[Math.floor(Math.random() * pool.length)];

    // Le ticket gagnant est "consommé" : on déduit les points correspondants
    winner.points = Math.max(0, (winner.points || 0) - POINTS_PAR_TICKET);
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

    const stockCell = view.querySelector(`[data-lot-stock="${lot.id}"]`);
    if (stockCell) stockCell.textContent = lot.quantite;

    const pointsCell = view.querySelector(`[data-client-points="${winner.id}"]`);
    if (pointsCell) pointsCell.textContent = winner.points;
    const ticketsCell = view.querySelector(`[data-client-tickets="${winner.id}"]`);
    if (ticketsCell) {
      const t = ticketsFor(winner.points);
      ticketsCell.innerHTML = t > 0 ? `<span class="pro-badge">${t} 🎟️</span>` : "—";
    }

    resultEl.innerHTML = `
      <div style="background:var(--paper);border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:12.5px;color:var(--ink-soft)">🎉 La roue s'arrête sur</div>
        <div style="font-family:var(--font-display);font-size:22px;color:var(--tomato);margin-top:4px">${escapeHtml(lot.nom)}</div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px">Gagné par</div>
        <div style="font-family:var(--font-heading);font-weight:600;font-size:17px">${escapeHtml(winner.nom)}</div>
        <div style="font-size:11.5px;color:var(--ink-soft);margin-top:8px">-${POINTS_PAR_TICKET} points déduits (ticket utilisé) — il lui reste ${winner.points} points</div>
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

window.ProFideliteView = ProFideliteView;
