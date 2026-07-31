// pro-commandes.js — Espace Pro : préparer une commande (client + article
// + quantité), avec statut En cours / Livrée / Rejetée.

const STATUTS = {
  en_cours: { label: "En cours", color: "#F2C14E" },
  livree: { label: "Livrée", color: "#3C8A3E" },
  rejetee: { label: "Rejetée", color: "#D64545" },
};

const POINTS_PAR_SANDWICH = 5;

function blankCommande() {
  return {
    id: crypto.randomUUID(),
    clientId: "",
    clientNom: "",
    articleId: "",
    articleNom: "",
    quantite: 1,
    prixUnitaire: 0,
    total: 0,
    statut: "en_cours",
    notes: "",
    date: new Date().toISOString(),
    pointsAttribues: false,
  };
}

// Crédite les points de fidélité (5 par sandwich) une seule fois par commande,
// au moment où elle passe (ou est créée) au statut "Livrée".
async function crediterPointsSiLivree(commande) {
  if (commande.statut !== "livree" || commande.pointsAttribues || !commande.clientId) return commande;

  const client = await DB.get(DB.STORES.clients, commande.clientId);
  if (client) {
    client.points = (client.points || 0) + commande.quantite * POINTS_PAR_SANDWICH;
    await DB.put(DB.STORES.clients, client);
  }
  return { ...commande, pointsAttribues: true };
}

const ProCommandesView = (() => {
  let viewRef = null;
  let clientsCache = [];
  let articlesCache = [];

  async function render(view) {
    viewRef = view;
    clientsCache = await DB.getAll(DB.STORES.clients);
    articlesCache = await DB.getAll(DB.STORES.articles);
    clientsCache.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
    articlesCache.sort((a, b) => (a.nom_fr || "").localeCompare(b.nom_fr || "", "fr"));

    // Arrivée directe depuis le catalogue public : ?article=<id>
    const preselectArticle = new URLSearchParams(window.location.search).get("article");
    if (preselectArticle) {
      // On nettoie l'URL pour éviter de rouvrir le formulaire à chaque rafraîchissement
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      await renderForm(view, null, preselectArticle);
      return;
    }

    await renderList(view);
  }

  async function renderList(view) {
    const commandes = await DB.getAll(DB.STORES.commandes);
    commandes.sort((a, b) => new Date(b.date) - new Date(a.date));

    view.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="pro-btn pro-btn-primary" data-action="nouvelle">+ Nouvelle commande</button>
      </div>

      ${
        commandes.length === 0
          ? `<div class="pro-empty">
              <p style="margin:0;font-size:13.5px">Aucune commande. Elles apparaissent ici quand un client choisit un article sur le catalogue et clique sur "Commander", ou via le bouton ci-dessus.</p>
              <button class="pro-btn pro-btn-primary" data-action="nouvelle">+ Nouvelle commande</button>
            </div>`
          : `<div class="pro-card" style="padding:0;overflow:auto">
              <table class="pro-table">
                <thead><tr><th>Date</th><th>Client</th><th>Article</th><th>Qté</th><th>Total</th><th>Statut</th><th></th></tr></thead>
                <tbody>${commandes.map(rowTemplate).join("")}</tbody>
              </table>
            </div>`
      }
    `;

    view.querySelectorAll("[data-action='nouvelle']").forEach((btn) => btn.addEventListener("click", () => renderForm(view)));
    view.querySelectorAll("[data-modifier]").forEach((btn) => btn.addEventListener("click", () => renderForm(view, btn.dataset.modifier)));
    view.querySelectorAll("[data-supprimer]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (confirm("Supprimer cette commande ?")) {
          await DB.delete(DB.STORES.commandes, btn.dataset.supprimer);
          await renderList(view);
        }
      })
    );
    view.querySelectorAll("[data-statut]").forEach((select) => {
      select.addEventListener("change", async () => {
        let commande = await DB.get(DB.STORES.commandes, select.dataset.statut);
        commande.statut = select.value;
        commande = await crediterPointsSiLivree(commande);
        await DB.put(DB.STORES.commandes, commande);
        await renderList(view);
      });
    });
  }

  function rowTemplate(c) {
    return `
      <tr>
        <td style="font-size:12.5px;white-space:nowrap">${new Date(c.date).toLocaleDateString("fr-FR")}</td>
        <td>${escapeHtml(c.clientNom) || "—"}</td>
        <td>${escapeHtml(c.articleNom)}</td>
        <td style="font-family:var(--font-mono)">${c.quantite}</td>
        <td style="font-family:var(--font-mono)">${(c.total || 0).toFixed(2)} MAD</td>
        <td>
          <select data-statut="${c.id}" style="border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-size:12px;background:${STATUTS[c.statut]?.color}22">
            ${Object.entries(STATUTS).map(([key, s]) => `<option value="${key}" ${c.statut === key ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
          ${c.pointsAttribues ? `<div style="font-size:10.5px;color:var(--leaf-dark);margin-top:3px">✓ +${c.quantite * POINTS_PAR_SANDWICH} pts</div>` : ""}
        </td>
        <td style="text-align:right;white-space:nowrap">
          <button class="pro-btn" data-modifier="${c.id}">Modifier</button>
          <button class="pro-btn pro-btn-danger" data-supprimer="${c.id}">Supprimer</button>
        </td>
      </tr>
    `;
  }

  async function renderForm(view, commandeId, preselectArticleId) {
    const commande = commandeId ? await DB.get(DB.STORES.commandes, commandeId) : blankCommande();
    if (!commandeId && preselectArticleId) commande.articleId = preselectArticleId;
    const isNew = !commandeId;

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <button class="pro-btn" data-action="retour">← Retour</button>
        <h2 style="font-family:var(--font-heading);font-size:17px;font-weight:600">${isNew ? "Nouvelle commande" : "Modifier la commande"}</h2>
      </div>

      <form id="commande-form" class="pro-card" style="display:flex;flex-direction:column;gap:14px;max-width:640px">
        <label class="pro-field">
          <span>Client</span>
          <select name="clientId" id="cmd-client">
            <option value="">— Sélectionner un client —</option>
            ${clientsCache.map((c) => `<option value="${c.id}" ${commande.clientId === c.id ? "selected" : ""}>${escapeHtml(c.nom)}</option>`).join("")}
          </select>
        </label>
        <label class="pro-field">
          <span>Ou nouveau client (nom)</span>
          <input name="clientNomLibre" placeholder="Laisser vide si sélectionné ci-dessus" />
        </label>

        <label class="pro-field">
          <span>Article *</span>
          <select required name="articleId" id="cmd-article">
            ${articlesCache.map((a) => `<option value="${a.id}" ${commande.articleId === a.id ? "selected" : ""}>${escapeHtml(a.nom_fr)} — ${a.prix_mad} MAD</option>`).join("")}
          </select>
        </label>

        <label class="pro-field">
          <span>Quantité *</span>
          <input required type="number" min="1" name="quantite" id="cmd-qte" value="${commande.quantite || 1}" />
        </label>

        <div id="cmd-price-preview" class="pro-card" style="background:var(--paper);border-style:dashed"></div>

        <label class="pro-field"><span>Statut</span>
          <select name="statut">
            ${Object.entries(STATUTS).map(([key, s]) => `<option value="${key}" ${commande.statut === key ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </label>

        <label class="pro-field"><span>Notes</span><textarea name="notes" rows="2">${escapeHtml(commande.notes)}</textarea></label>

        <div style="display:flex;gap:10px">
          <button type="submit" class="pro-btn pro-btn-primary">Enregistrer</button>
          <button type="button" class="pro-btn" data-action="retour">Annuler</button>
        </div>
      </form>
    `;

    function updatePricePreview() {
      const articleId = view.querySelector("#cmd-article").value;
      const clientId = view.querySelector("#cmd-client").value;
      const qty = Math.max(1, parseInt(view.querySelector("#cmd-qte").value, 10) || 1);
      const article = articlesCache.find((a) => a.id === articleId);
      const client = clientsCache.find((c) => c.id === clientId);
      if (!article) return;

      const { prix, source } = window.computeClientPrice
        ? window.computeClientPrice(article, client, qty)
        : { prix: article.prix_mad, source: "standard" };
      const total = (prix * qty).toFixed(2);

      view.querySelector("#cmd-price-preview").innerHTML = `
        <strong>${prix} MAD</strong> / unité ${source === "negocie" ? `<span class="pro-badge">tarif négocié</span>` : `<span class="pro-badge">prix standard</span>`}
        — total : <strong>${total} MAD</strong>
      `;
    }

    ["#cmd-article", "#cmd-client", "#cmd-qte"].forEach((sel) => view.querySelector(sel).addEventListener("input", updatePricePreview));
    updatePricePreview();

    view.querySelectorAll('[data-action="retour"]').forEach((btn) => btn.addEventListener("click", () => renderList(view)));

    view.querySelector("#commande-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      const articleId = fd.get("articleId");
      const article = articlesCache.find((a) => a.id === articleId);
      let clientId = fd.get("clientId");
      let clientNom = "";

      const clientNomLibre = fd.get("clientNomLibre").trim();
      if (clientNomLibre) {
        const nouveauClient = { id: crypto.randomUUID(), nom: clientNomLibre, societe: "", telephone: "", email: "", notes: "", tarifs: {} };
        await DB.put(DB.STORES.clients, nouveauClient);
        clientId = nouveauClient.id;
        clientNom = nouveauClient.nom;
      } else if (clientId) {
        clientNom = clientsCache.find((c) => c.id === clientId)?.nom || "";
      }

      const quantite = Math.max(1, parseInt(fd.get("quantite"), 10) || 1);
      const client = clientsCache.find((c) => c.id === clientId);
      const { prix } = window.computeClientPrice
        ? window.computeClientPrice(article, client, quantite)
        : { prix: article.prix_mad };

      const updated = {
        ...commande,
        clientId,
        clientNom,
        articleId,
        articleNom: article.nom_fr,
        quantite,
        prixUnitaire: prix,
        total: prix * quantite,
        statut: fd.get("statut"),
        notes: fd.get("notes").trim(),
      };

      const withPoints = await crediterPointsSiLivree(updated);
      await DB.put(DB.STORES.commandes, withPoints);
      await renderList(view);
    });
  }

  return { render };
})();

window.ProCommandesView = ProCommandesView;
