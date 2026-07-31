// pro-parametres.js — Espace Pro : sauvegarde/restauration/réinitialisation
// des données, et export de rapports (commandes, clients, tombola) en CSV.

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM pour Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ProParametresView = (() => {
  async function render(view) {
    const [articles, clients, commandes] = await Promise.all([
      DB.getAll(DB.STORES.articles),
      DB.getAll(DB.STORES.clients),
      DB.getAll(DB.STORES.commandes),
    ]);

    view.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:20px;max-width:640px">

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Sauvegarde &amp; restauration</h3>
          <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">
            ${articles.length} article${articles.length > 1 ? "s" : ""}, ${clients.length} client${clients.length > 1 ? "s" : ""},
            ${commandes.length} commande${commandes.length > 1 ? "s" : ""} enregistrés sur cet appareil.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="pro-btn pro-btn-primary" id="btn-export-json">⬇ Exporter tout (sauvegarde complète)</button>
            <label class="pro-btn" style="cursor:pointer;margin:0">
              ⬆ Importer une sauvegarde
              <input type="file" id="import-json" accept="application/json" style="display:none" />
            </label>
            <button class="pro-btn pro-btn-danger" id="btn-reset">🗑 Réinitialiser toutes les données</button>
          </div>
        </div>

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Rapports (export CSV, ouvrables dans Excel)</h3>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
            <button class="pro-btn" id="btn-export-commandes" style="justify-content:flex-start">🧾 Rapport Commandes — Article / Quantité / PUV / Total / Statut</button>
            <button class="pro-btn" id="btn-export-clients" style="justify-content:flex-start">👤 Relevé Clients détaillé</button>
            <button class="pro-btn" id="btn-export-tombola" style="justify-content:flex-start">🎡 Rapport Tombola</button>
          </div>
        </div>

      </div>
    `;

    view.querySelector("#btn-export-json").addEventListener("click", async () => {
      const data = {
        exported_at: new Date().toISOString(),
        articles: await DB.getAll(DB.STORES.articles),
        clients: await DB.getAll(DB.STORES.clients),
        commandes: await DB.getAll(DB.STORES.commandes),
        reclamations: await DB.getAll(DB.STORES.reclamations),
        lots: await DB.getAll(DB.STORES.lots),
        tirages: await DB.getAll(DB.STORES.tirages),
      };
      downloadJSON(`pauseattitude-catalogue-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, data);
    });

    view.querySelector("#import-json").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const stores = ["articles", "clients", "commandes", "reclamations", "lots", "tirages"];
        const counts = {};
        for (const store of stores) {
          if (Array.isArray(data[store])) {
            counts[store] = data[store].length;
            for (const item of data[store]) await DB.put(DB.STORES[store], item);
          }
        }
        alert("Restauration terminée :\n" + Object.entries(counts).map(([k, v]) => `${k} : ${v}`).join("\n"));
        e.target.value = "";
        render(view);
      } catch (err) {
        alert("Fichier de sauvegarde invalide.");
      }
    });

    view.querySelector("#btn-reset").addEventListener("click", async () => {
      if (!confirm("Supprimer TOUTES les données (articles, clients, commandes, lots, tirages, réclamations) ? Cette action est définitive.")) return;
      if (!confirm("Dernière confirmation : vraiment tout réinitialiser ?")) return;

      const stores = ["articles", "clients", "commandes", "reclamations", "lots", "tirages"];
      for (const store of stores) {
        const items = await DB.getAll(DB.STORES[store]);
        for (const item of items) await DB.delete(DB.STORES[store], item.id);
      }
      await DB.seedIfEmpty();
      alert("Toutes les données ont été réinitialisées. Les articles de départ ont été restaurés.");
      render(view);
    });

    view.querySelector("#btn-export-commandes").addEventListener("click", async () => {
      const list = await DB.getAll(DB.STORES.commandes);
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      const rows = [
        ["Date", "Client", "Article", "Quantité", "PUV (MAD)", "Total (MAD)", "Statut"],
        ...list.map((c) => [
          new Date(c.date).toLocaleDateString("fr-FR"),
          c.clientNom || "",
          c.articleNom || "",
          c.quantite,
          (c.prixUnitaire || 0).toFixed(2),
          (c.total || 0).toFixed(2),
          STATUTS[c.statut]?.label || c.statut,
        ]),
      ];
      downloadCSV(`rapport-commandes-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    });

    view.querySelector("#btn-export-clients").addEventListener("click", async () => {
      const [list, commandesList] = await Promise.all([DB.getAll(DB.STORES.clients), DB.getAll(DB.STORES.commandes)]);
      list.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));
      const rows = [
        ["Nom", "Société", "Téléphone", "Email", "Points", "Tickets tombola", "Nb commandes", "Total commandé (MAD)", "Tarifs négociés"],
        ...list.map((c) => {
          const commandesClient = commandesList.filter((cmd) => cmd.clientId === c.id);
          const totalCommande = commandesClient.reduce((s, cmd) => s + (cmd.total || 0), 0);
          return [
            c.nom || "",
            c.societe || "",
            c.telephone || "",
            c.email || "",
            c.points || 0,
            Math.floor((c.points || 0) / 100),
            commandesClient.length,
            totalCommande.toFixed(2),
            Object.keys(c.tarifs || {}).length,
          ];
        }),
      ];
      downloadCSV(`releve-clients-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    });

    view.querySelector("#btn-export-tombola").addEventListener("click", async () => {
      const list = await DB.getAll(DB.STORES.tirages);
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      const rows = [
        ["Date", "Gagnant", "Lot"],
        ...list.map((t) => [new Date(t.date).toLocaleString("fr-FR"), t.gagnant || "", t.lot || ""]),
      ];
      downloadCSV(`rapport-tombola-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    });
  }

  return { render };
})();

window.ProParametresView = ProParametresView;
