// pro-fidelite.js — Espace Pro : points de fidélité des clients uniquement.
// La gestion des lots et la roue de la tombola sont dans des écrans séparés
// (pro-lots.js et pro-tombola.js).

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
    const clients = await DB.getAll(DB.STORES.clients);
    clients.sort((a, b) => (b.points || 0) - (a.points || 0));

    view.innerHTML = `
      <div class="pro-card">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Points de fidélité</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">
          ${POINTS_PAR_TICKET} points = 1 ticket de tombola. 5 points sont crédités automatiquement par sandwich livré
          (voir <a href="#/commandes" style="color:var(--leaf-dark)">Commandes</a>), ou ajoutez-en manuellement ci-dessous.
        </p>
        ${
          clients.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft)">Aucun client. Créez d'abord des fiches clients dans l'onglet <a href="#/clients" style="color:var(--leaf-dark)">Clients &amp; tarifs</a>.</p>`
            : `<table class="pro-table">
                <thead><tr><th>Client</th><th>Points</th><th>Tickets</th><th></th></tr></thead>
                <tbody>${clients.map(clientRowTemplate).join("")}</tbody>
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

  return { render };
})();

window.ProFideliteView = ProFideliteView;
