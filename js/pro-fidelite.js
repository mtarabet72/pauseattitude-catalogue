// pro-fidelite.js — Espace Pro : points de fidélité par client et
// tirage au sort de la tombola (pondéré par nombre de tickets).

const POINTS_PAR_TICKET = 100;

function ticketsFor(points) {
  return Math.floor((points || 0) / POINTS_PAR_TICKET);
}

const ProFideliteView = (() => {
  let viewRef = null;

  async function render(view) {
    viewRef = view;
    await draw();
  }

  async function draw() {
    const view = viewRef;
    const [clients, tirages] = await Promise.all([
      DB.getAll(DB.STORES.clients),
      DB.getAll(DB.STORES.tirages),
    ]);
    clients.sort((a, b) => (b.points || 0) - (a.points || 0));
    tirages.sort((a, b) => new Date(b.date) - new Date(a.date));

    const eligibles = clients.filter((c) => ticketsFor(c.points) >= 1);

    view.innerHTML = `
      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Points de fidélité</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">${POINTS_PAR_TICKET} points = 1 ticket de tombola. Ajoutez des points après une commande.</p>

        ${
          clients.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft)">Aucun client. Créez d'abord des fiches clients dans l'onglet <a href="#/clients" style="color:var(--leaf-dark)">Clients &amp; tarifs</a>.</p>`
            : `<table class="pro-table">
                <thead><tr><th>Client</th><th>Points</th><th>Tickets</th><th></th></tr></thead>
                <tbody>
                  ${clients.map(clientRowTemplate).join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Tombola</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">
          ${eligibles.length} client${eligibles.length > 1 ? "s" : ""} éligible${eligibles.length > 1 ? "s" : ""}
          (≥ 1 ticket) — ${eligibles.reduce((s, c) => s + ticketsFor(c.points), 0)} tickets au total.
        </p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input id="tombola-lot" type="text" placeholder="Lot à gagner (ex. Sandwich offert x5)" style="flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <button class="pro-btn pro-btn-primary" id="btn-tirer" ${eligibles.length === 0 ? "disabled" : ""}>🎲 Lancer le tirage</button>
        </div>
        <div id="tombola-result" style="margin-top:16px"></div>
      </div>

      <div class="pro-card">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:10px">Historique des tirages</h3>
        ${
          tirages.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft);margin:0">Aucun tirage effectué pour l'instant.</p>`
            : `<table class="pro-table">
                <thead><tr><th>Date</th><th>Gagnant</th><th>Lot</th></tr></thead>
                <tbody>
                  ${tirages.map((t) => `<tr><td>${new Date(t.date).toLocaleString("fr-FR")}</td><td>${escapeHtml(t.gagnant)}</td><td>${escapeHtml(t.lot || "—")}</td></tr>`).join("")}
                </tbody>
              </table>`
        }
      </div>
    `;

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

    view.querySelector("#btn-tirer")?.addEventListener("click", () => runTirage(eligibles));
  }

  function clientRowTemplate(c) {
    const points = c.points || 0;
    const tickets = ticketsFor(points);
    return `
      <tr>
        <td>${escapeHtml(c.nom) || "(sans nom)"}</td>
        <td style="font-family:var(--font-mono)">${points}</td>
        <td>${tickets > 0 ? `<span class="pro-badge">${tickets} 🎟️</span>` : "—"}</td>
        <td style="white-space:nowrap">
          <input type="number" min="1" placeholder="+ pts" data-points-input="${c.id}" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12.5px" />
          <button class="pro-btn" data-add-points="${c.id}" style="padding:6px 10px">Ajouter</button>
        </td>
      </tr>
    `;
  }

  async function runTirage(eligibles) {
    const view = viewRef;
    const lot = view.querySelector("#tombola-lot").value.trim();

    // Pool pondéré : chaque client apparaît autant de fois que son nombre de tickets
    const pool = [];
    eligibles.forEach((c) => {
      for (let i = 0; i < ticketsFor(c.points); i++) pool.push(c);
    });

    const resultEl = view.querySelector("#tombola-result");
    resultEl.innerHTML = `<p style="font-size:13.5px;color:var(--ink-soft)">Tirage en cours…</p>`;

    // Petit effet de suspense avant de révéler le résultat
    await new Promise((r) => setTimeout(r, 700));

    const winner = pool[Math.floor(Math.random() * pool.length)];

    const tirage = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      gagnant: winner.nom,
      gagnantId: winner.id,
      lot,
    };
    await DB.put(DB.STORES.tirages, tirage);

    resultEl.innerHTML = `
      <div style="background:var(--paper);border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:12.5px;color:var(--ink-soft)">🎉 Gagnant</div>
        <div style="font-family:var(--font-display);font-size:26px;color:var(--tomato);margin-top:4px">${escapeHtml(winner.nom)}</div>
        ${lot ? `<div style="font-size:13.5px;margin-top:6px">${escapeHtml(lot)}</div>` : ""}
        <p style="font-size:12px;color:var(--ink-soft);margin:10px 0 0">Enregistré dans l'historique ci-dessous.</p>
      </div>
    `;

    const newHistoryRow = `<tr><td>${new Date(tirage.date).toLocaleString("fr-FR")}</td><td>${escapeHtml(tirage.gagnant)}</td><td>${escapeHtml(tirage.lot || "—")}</td></tr>`;
    const historyBody = view.querySelector(".pro-card:last-child tbody");
    if (historyBody) {
      historyBody.insertAdjacentHTML("afterbegin", newHistoryRow);
    } else {
      // première entrée d'historique : on doit reconstruire ce bloc
      const historyCard = view.querySelectorAll(".pro-card")[2];
      if (historyCard) {
        historyCard.innerHTML = `
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:10px">Historique des tirages</h3>
          <table class="pro-table">
            <thead><tr><th>Date</th><th>Gagnant</th><th>Lot</th></tr></thead>
            <tbody>${newHistoryRow}</tbody>
          </table>
        `;
      }
    }
  }

  return { render };
})();

window.ProFideliteView = ProFideliteView;
