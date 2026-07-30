// pro-clients.js — Espace Pro : fiches clients + paliers de tarifs
// négociés par quantité (ex. 20-29 unités → prix réduit).

function blankClient() {
  return {
    id: crypto.randomUUID(),
    nom: "",
    societe: "",
    telephone: "",
    email: "",
    notes: "",
    tarifs: {}, // { [articleId]: [{min, max, prix}, ...] }
  };
}

// Calcule le prix applicable pour un client + article + quantité donnés.
// Renvoie { prix, source: "negocie"|"standard" }.
function computeClientPrice(article, client, quantite) {
  const paliers = client?.tarifs?.[article.id];
  if (paliers && paliers.length) {
    const match = paliers.find((p) => quantite >= p.min && (p.max == null || quantite <= p.max));
    if (match) return { prix: match.prix, source: "negocie" };
  }
  return { prix: article.prix_mad, source: "standard" };
}

const ProClientsView = (() => {
  let viewRef = null;
  let editingId = null;
  let articlesCache = [];

  async function render(view) {
    viewRef = view;
    editingId = null;
    articlesCache = await DB.getAll(DB.STORES.articles);
    articlesCache.sort((a, b) => (a.nom_fr || "").localeCompare(b.nom_fr || "", "fr"));
    await renderList(view);
  }

  async function renderList(view) {
    const clients = await DB.getAll(DB.STORES.clients);
    clients.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

    view.innerHTML = `
      <div class="pro-card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:12px">Simulateur de prix</h3>
        <div class="pro-grid-3">
          <label class="pro-field"><span>Client</span>
            <select id="sim-client">
              <option value="">— Prix standard —</option>
              ${clients.map((c) => `<option value="${c.id}">${escapeHtml(c.nom)}</option>`).join("")}
            </select>
          </label>
          <label class="pro-field"><span>Article</span>
            <select id="sim-article">
              ${articlesCache.map((a) => `<option value="${a.id}">${escapeHtml(a.nom_fr)}</option>`).join("")}
            </select>
          </label>
          <label class="pro-field"><span>Quantité</span><input id="sim-qty" type="number" min="1" value="20" /></label>
        </div>
        <div id="sim-result" style="margin-top:12px;font-size:14px"></div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="pro-btn pro-btn-primary" data-action="nouveau">+ Nouveau client</button>
      </div>

      ${
        clients.length === 0
          ? `<div class="pro-empty">
              <p style="margin:0;font-size:13.5px">Aucun client enregistré.</p>
              <button class="pro-btn pro-btn-primary" data-action="nouveau">+ Nouveau client</button>
            </div>`
          : `<div class="pro-card" style="padding:0;overflow:auto">
              <table class="pro-table">
                <thead><tr><th>Client</th><th>Contact</th><th>Tarifs négociés</th><th></th></tr></thead>
                <tbody>${clients.map(rowTemplate).join("")}</tbody>
              </table>
            </div>`
      }
    `;

    view.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", (e) => onListAction(e, clients)));

    const simClient = view.querySelector("#sim-client");
    const simArticle = view.querySelector("#sim-article");
    const simQty = view.querySelector("#sim-qty");
    const updateSim = () => {
      const article = articlesCache.find((a) => a.id === simArticle.value);
      const client = clients.find((c) => c.id === simClient.value);
      if (!article) return;
      const qty = Math.max(1, parseInt(simQty.value, 10) || 1);
      const { prix, source } = computeClientPrice(article, client, qty);
      const total = (prix * qty).toFixed(2);
      view.querySelector("#sim-result").innerHTML = `
        <strong>${prix} MAD</strong> / unité ${source === "negocie" ? `<span class="pro-badge">tarif négocié</span>` : `<span class="pro-badge">prix standard</span>`}
        — total pour ${qty} : <strong>${total} MAD</strong>
      `;
    };
    [simClient, simArticle, simQty].forEach((el) => el.addEventListener("input", updateSim));
    updateSim();
  }

  function rowTemplate(c) {
    const nbTarifs = Object.keys(c.tarifs || {}).length;
    return `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(c.nom) || "(sans nom)"}</div>
          <div style="color:var(--ink-soft);font-size:12px">${escapeHtml(c.societe)}</div>
        </td>
        <td style="font-size:12.5px">${escapeHtml(c.telephone)}${c.telephone && c.email ? "<br>" : ""}${escapeHtml(c.email)}</td>
        <td>${nbTarifs > 0 ? `<span class="pro-badge">${nbTarifs} article${nbTarifs > 1 ? "s" : ""}</span>` : "—"}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="pro-btn" data-action="modifier" data-id="${c.id}">Modifier</button>
          <button class="pro-btn pro-btn-danger" data-action="supprimer" data-id="${c.id}">Supprimer</button>
        </td>
      </tr>
    `;
  }

  async function onListAction(e, clients) {
    const action = e.currentTarget.dataset.action;
    const id = e.currentTarget.dataset.id;

    if (action === "nouveau") {
      editingId = null;
      await renderForm(viewRef);
    } else if (action === "modifier") {
      editingId = id;
      await renderForm(viewRef);
    } else if (action === "supprimer") {
      const client = clients.find((c) => c.id === id);
      if (client && confirm(`Supprimer la fiche de « ${client.nom} » ?`)) {
        await DB.delete(DB.STORES.clients, id);
        await renderList(viewRef);
      }
    }
  }

  async function renderForm(view) {
    const client = editingId ? await DB.get(DB.STORES.clients, editingId) : blankClient();
    const isNew = !editingId;

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <button class="pro-btn" data-action="retour">← Retour</button>
        <h2 style="font-family:var(--font-heading);font-size:17px;font-weight:600">${isNew ? "Nouveau client" : "Modifier le client"}</h2>
      </div>

      <form id="pro-client-form" style="display:flex;flex-direction:column;gap:16px;max-width:760px">
        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:14px">Identité</h3>
          <div class="pro-grid-2">
            <label class="pro-field"><span>Nom *</span><input required name="nom" value="${escapeHtml(client.nom)}" /></label>
            <label class="pro-field"><span>Société</span><input name="societe" value="${escapeHtml(client.societe)}" /></label>
            <label class="pro-field"><span>Téléphone</span><input name="telephone" value="${escapeHtml(client.telephone)}" /></label>
            <label class="pro-field"><span>Email</span><input type="email" name="email" value="${escapeHtml(client.email)}" /></label>
          </div>
          <label class="pro-field" style="margin-top:12px"><span>Notes</span><textarea name="notes" rows="2">${escapeHtml(client.notes)}</textarea></label>
        </div>

        <div class="pro-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin:0">Tarifs négociés par quantité</h3>
            <button type="button" class="pro-btn" id="add-tarif-article">+ Ajouter un article</button>
          </div>
          <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Définissez, pour un article, un prix différent selon la quantité commandée (ex. 20 à 29 unités → 20 MAD).</p>
          <div id="tarifs-list" style="display:flex;flex-direction:column;gap:16px"></div>
        </div>

        <div style="display:flex;gap:10px;align-items:center">
          <button type="submit" class="pro-btn pro-btn-primary">Enregistrer</button>
          <button type="button" class="pro-btn" data-action="retour">Annuler</button>
        </div>
      </form>
    `;

    const tarifsState = JSON.parse(JSON.stringify(client.tarifs || {}));

    function renderTarifs() {
      const container = view.querySelector("#tarifs-list");
      const articleIds = Object.keys(tarifsState);

      if (articleIds.length === 0) {
        container.innerHTML = `<p style="font-size:12.5px;color:var(--ink-soft);margin:0">Aucun tarif négocié pour l'instant.</p>`;
        return;
      }

      container.innerHTML = articleIds
        .map((articleId) => {
          const article = articlesCache.find((a) => a.id === articleId);
          const nom = article ? article.nom_fr : "(article supprimé)";
          const paliers = tarifsState[articleId];
          return `
            <div class="pro-card" style="background:var(--paper);border-style:dashed" data-article-block="${articleId}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <strong style="font-size:13.5px">${escapeHtml(nom)}</strong>
                <button type="button" class="pro-btn pro-btn-danger" data-remove-article="${articleId}">Retirer</button>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${paliers
                  .map(
                    (p, i) => `
                  <div style="display:flex;gap:8px;align-items:center" data-palier-row="${articleId}:${i}">
                    <input type="number" min="1" placeholder="Min" value="${p.min ?? ""}" data-field="min" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:6px" />
                    <span style="font-size:12.5px;color:var(--ink-soft)">à</span>
                    <input type="number" min="1" placeholder="Max (vide = ∞)" value="${p.max ?? ""}" data-field="max" style="width:100px;padding:6px 8px;border:1px solid var(--line);border-radius:6px" />
                    <span style="font-size:12.5px;color:var(--ink-soft)">→</span>
                    <input type="number" min="0" step="0.5" placeholder="Prix MAD" value="${p.prix ?? ""}" data-field="prix" style="width:90px;padding:6px 8px;border:1px solid var(--line);border-radius:6px" />
                    <button type="button" class="pro-btn pro-btn-danger" data-remove-palier="${articleId}:${i}" style="padding:6px 10px">✕</button>
                  </div>
                `
                  )
                  .join("")}
              </div>
              <button type="button" class="pro-btn" data-add-palier="${articleId}" style="margin-top:8px">+ Ajouter un palier</button>
            </div>
          `;
        })
        .join("");

      container.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("input", () => {
          const row = input.closest("[data-palier-row]");
          const [articleId, idx] = row.dataset.palierRow.split(":");
          const i = Number(idx);
          const field = input.dataset.field;
          const val = input.value === "" ? null : Number(input.value);
          tarifsState[articleId][i][field] = val;
        });
      });

      container.querySelectorAll("[data-add-palier]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const articleId = btn.dataset.addPalier;
          tarifsState[articleId].push({ min: null, max: null, prix: null });
          renderTarifs();
        });
      });

      container.querySelectorAll("[data-remove-palier]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const [articleId, idx] = btn.dataset.removePalier.split(":");
          tarifsState[articleId].splice(Number(idx), 1);
          renderTarifs();
        });
      });

      container.querySelectorAll("[data-remove-article]").forEach((btn) => {
        btn.addEventListener("click", () => {
          delete tarifsState[btn.dataset.removeArticle];
          renderTarifs();
        });
      });
    }

    renderTarifs();

    view.querySelector("#add-tarif-article").addEventListener("click", () => {
      const available = articlesCache.filter((a) => !(a.id in tarifsState));
      if (available.length === 0) {
        alert("Tous les articles ont déjà un tarif négocié pour ce client.");
        return;
      }
      const articleId = available[0].id;
      tarifsState[articleId] = [{ min: 20, max: 29, prix: available[0].prix_mad }];
      renderTarifs();
    });

    view.querySelectorAll('[data-action="retour"]').forEach((btn) =>
      btn.addEventListener("click", async () => {
        await renderList(viewRef);
      })
    );

    view.querySelector("#pro-client-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      // Nettoyer les paliers incomplets avant sauvegarde
      const cleanTarifs = {};
      for (const [articleId, paliers] of Object.entries(tarifsState)) {
        const valid = paliers.filter((p) => p.min != null && p.prix != null);
        if (valid.length) cleanTarifs[articleId] = valid;
      }

      const updated = {
        ...client,
        nom: fd.get("nom").trim(),
        societe: fd.get("societe").trim(),
        telephone: fd.get("telephone").trim(),
        email: fd.get("email").trim(),
        notes: fd.get("notes").trim(),
        tarifs: cleanTarifs,
      };

      await DB.put(DB.STORES.clients, updated);
      await renderList(viewRef);
    });
  }

  return { render };
})();

window.ProClientsView = ProClientsView;
window.computeClientPrice = computeClientPrice;
