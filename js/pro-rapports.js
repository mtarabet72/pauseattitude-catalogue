// pro-rapports.js — Génère des rapports PDF (via impression navigateur)
// avec en-tête, indicateurs clés, graphiques SVG et tableau détaillé.

const RAPPORT_COLORS = ["#3C8A3E", "#D64545", "#F2C14E", "#B9793F", "#4A4785", "#3F7EA6", "#D9603B", "#2C6B2E"];

function svgBarChart(data, { width = 680, height = 220, color } = {}) {
  if (data.length === 0) {
    return `<p style="font-size:11px;color:#9a9488">Aucune donnée à afficher.</p>`;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = width / data.length;
  const barW = Math.min(70, gap * 0.55);
  const chartH = height - 40;

  const bars = data
    .map((d, i) => {
      const h = (d.value / max) * chartH;
      const x = i * gap + (gap - barW) / 2;
      const y = chartH - h + 10;
      const fill = d.color || color || RAPPORT_COLORS[i % RAPPORT_COLORS.length];
      const label = String(d.label).length > 14 ? String(d.label).slice(0, 13) + "…" : d.label;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" rx="3" />
        <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="10" text-anchor="middle" fill="#23291f" font-family="IBM Plex Mono, monospace">${d.value}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${height - 6}" font-size="9.5" text-anchor="middle" fill="#5a5648">${escapeHtml(label)}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px">
      <line x1="0" y1="${chartH + 10}" x2="${width}" y2="${chartH + 10}" stroke="#e6ddc8" />
      ${bars}
    </svg>
  `;
}

function svgDonutChart(data, { size = 200, hole = 0.55 } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2;
  const cx = r, cy = r;
  let angle = -90;

  const slices = data
    .map((d, i) => {
      const share = d.value / total;
      const startAngle = angle;
      const endAngle = angle + share * 360;
      angle = endAngle;
      const large = endAngle - startAngle > 180 ? 1 : 0;
      const p1 = { x: cx + r * Math.cos((startAngle * Math.PI) / 180), y: cy + r * Math.sin((startAngle * Math.PI) / 180) };
      const p2 = { x: cx + r * Math.cos((endAngle * Math.PI) / 180), y: cy + r * Math.sin((endAngle * Math.PI) / 180) };
      const fill = d.color || RAPPORT_COLORS[i % RAPPORT_COLORS.length];
      return `<path d="M${cx},${cy} L${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y} Z" fill="${fill}" stroke="#fff" stroke-width="1.5" />`;
    })
    .join("");

  const legend = data
    .map((d, i) => {
      const pct = ((d.value / total) * 100).toFixed(0);
      const color = d.color || RAPPORT_COLORS[i % RAPPORT_COLORS.length];
      return `<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;margin-bottom:4px">
        <span style="width:9px;height:9px;border-radius:2px;background:${color};display:inline-block;flex-shrink:0"></span>
        ${escapeHtml(d.label)} — ${d.value} (${pct}%)
      </div>`;
    })
    .join("");

  return `
    <div style="display:flex;align-items:center;gap:20px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${slices}
        <circle cx="${cx}" cy="${cy}" r="${r * hole}" fill="#fff" />
      </svg>
      <div>${legend}</div>
    </div>
  `;
}

function rapportHeaderHTML(title) {
  return `
    <div class="rapport-header">
      <div>
        <h1>${title}</h1>
        <div class="brand">Pause Attitude — Espace Pro</div>
      </div>
      <div class="date">Édité le ${new Date().toLocaleString("fr-FR")}</div>
    </div>
  `;
}

function buildCommandesReportHTML(commandes) {
  const sorted = [...commandes].sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = sorted.reduce((s, c) => s + (c.total || 0), 0);
  const parStatut = { en_cours: 0, livree: 0, rejetee: 0 };
  sorted.forEach((c) => { if (parStatut[c.statut] != null) parStatut[c.statut]++; });

  const parArticle = {};
  sorted.forEach((c) => {
    parArticle[c.articleNom] = (parArticle[c.articleNom] || 0) + (c.total || 0);
  });
  const topArticles = Object.entries(parArticle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value: Math.round(value) }));

  return `
    <div class="rapport-page">
      ${rapportHeaderHTML("Rapport Commandes")}

      <div class="rapport-stats">
        <div class="rapport-stat"><div class="label">Commandes</div><div class="value">${sorted.length}</div></div>
        <div class="rapport-stat"><div class="label">Chiffre d'affaires</div><div class="value">${total.toFixed(0)} MAD</div></div>
        <div class="rapport-stat"><div class="label">Livrées</div><div class="value">${parStatut.livree}</div></div>
        <div class="rapport-stat"><div class="label">En cours</div><div class="value">${parStatut.en_cours}</div></div>
        <div class="rapport-stat"><div class="label">Rejetées</div><div class="value">${parStatut.rejetee}</div></div>
      </div>

      <div class="rapport-chart">
        <div class="rapport-section-title">Chiffre d'affaires par article (MAD)</div>
        ${svgBarChart(topArticles)}
      </div>

      <div class="rapport-chart">
        <div class="rapport-section-title">Répartition par statut</div>
        ${svgDonutChart([
          { label: "En cours", value: parStatut.en_cours, color: "#F2C14E" },
          { label: "Livrée", value: parStatut.livree, color: "#3C8A3E" },
          { label: "Rejetée", value: parStatut.rejetee, color: "#D64545" },
        ])}
      </div>

      <div class="rapport-section-title">Détail des commandes</div>
      <table class="rapport-table">
        <thead><tr><th>Date</th><th>Client</th><th>Article</th><th>Qté</th><th>PUV</th><th>Total</th><th>Statut</th></tr></thead>
        <tbody>
          ${sorted
            .map(
              (c) => `<tr>
                <td>${new Date(c.date).toLocaleDateString("fr-FR")}</td>
                <td>${escapeHtml(c.clientNom || "—")}</td>
                <td>${escapeHtml(c.articleNom)}</td>
                <td>${c.quantite}</td>
                <td>${(c.prixUnitaire || 0).toFixed(2)}</td>
                <td>${(c.total || 0).toFixed(2)}</td>
                <td>${STATUTS[c.statut]?.label || c.statut}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="rapport-footer">pauseattitude.ma — rapport généré automatiquement</div>
    </div>
  `;
}

function buildClientsReportHTML(clients, commandesList) {
  const sorted = [...clients].sort((a, b) => (b.points || 0) - (a.points || 0));
  const enrichis = sorted.map((c) => {
    const commandesClient = commandesList.filter((cmd) => cmd.clientId === c.id);
    const totalCommande = commandesClient.reduce((s, cmd) => s + (cmd.total || 0), 0);
    return { ...c, nbCommandes: commandesClient.length, totalCommande };
  });

  const topClients = [...enrichis]
    .sort((a, b) => b.totalCommande - a.totalCommande)
    .slice(0, 8)
    .map((c) => ({ label: c.nom, value: Math.round(c.totalCommande) }));

  const totalPoints = enrichis.reduce((s, c) => s + (c.points || 0), 0);
  const totalCA = enrichis.reduce((s, c) => s + c.totalCommande, 0);

  return `
    <div class="rapport-page">
      ${rapportHeaderHTML("Relevé Clients détaillé")}

      <div class="rapport-stats">
        <div class="rapport-stat"><div class="label">Clients</div><div class="value">${enrichis.length}</div></div>
        <div class="rapport-stat"><div class="label">Points cumulés</div><div class="value">${totalPoints}</div></div>
        <div class="rapport-stat"><div class="label">CA total</div><div class="value">${totalCA.toFixed(0)} MAD</div></div>
      </div>

      <div class="rapport-chart">
        <div class="rapport-section-title">Top clients par chiffre d'affaires (MAD)</div>
        ${svgBarChart(topClients, { color: "#3C8A3E" })}
      </div>

      <div class="rapport-section-title">Détail par client</div>
      <table class="rapport-table">
        <thead><tr><th>Nom</th><th>Société</th><th>Téléphone</th><th>Points</th><th>Tickets</th><th>Nb cmd.</th><th>Total (MAD)</th></tr></thead>
        <tbody>
          ${enrichis
            .map(
              (c) => `<tr>
                <td>${escapeHtml(c.nom)}</td>
                <td>${escapeHtml(c.societe || "—")}</td>
                <td>${escapeHtml(c.telephone || "—")}</td>
                <td>${c.points || 0}</td>
                <td>${Math.floor((c.points || 0) / 100)}</td>
                <td>${c.nbCommandes}</td>
                <td>${c.totalCommande.toFixed(2)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="rapport-footer">pauseattitude.ma — rapport généré automatiquement</div>
    </div>
  `;
}

function buildTombolaReportHTML(tirages, lots) {
  const sorted = [...tirages].sort((a, b) => new Date(b.date) - new Date(a.date));
  const parLot = {};
  sorted.forEach((t) => { parLot[t.lot] = (parLot[t.lot] || 0) + 1; });
  const chartLots = Object.entries(parLot).map(([label, value]) => ({ label, value }));

  return `
    <div class="rapport-page">
      ${rapportHeaderHTML("Rapport Tombola")}

      <div class="rapport-stats">
        <div class="rapport-stat"><div class="label">Tirages effectués</div><div class="value">${sorted.length}</div></div>
        <div class="rapport-stat"><div class="label">Lots distincts gagnés</div><div class="value">${chartLots.length}</div></div>
        <div class="rapport-stat"><div class="label">Lots encore en stock</div><div class="value">${lots.reduce((s, l) => s + (l.quantite || 0), 0)}</div></div>
      </div>

      <div class="rapport-chart">
        <div class="rapport-section-title">Lots distribués</div>
        ${svgBarChart(chartLots, { color: "#D64545" })}
      </div>

      <div class="rapport-section-title">Détail des tirages</div>
      <table class="rapport-table">
        <thead><tr><th>Date</th><th>Gagnant</th><th>Lot</th></tr></thead>
        <tbody>
          ${sorted
            .map(
              (t) => `<tr>
                <td>${new Date(t.date).toLocaleString("fr-FR")}</td>
                <td>${escapeHtml(t.gagnant)}</td>
                <td>${escapeHtml(t.lot || "—")}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <div class="rapport-footer">pauseattitude.ma — rapport généré automatiquement</div>
    </div>
  `;
}

function printReport(html) {
  let container = document.getElementById("rapport-print-area");
  if (!container) {
    container = document.createElement("div");
    container.id = "rapport-print-area";
    container.className = "rapport-print-area";
    document.body.appendChild(container);
  }
  container.innerHTML = html;
  setTimeout(() => window.print(), 50);
}

window.printReport = printReport;
window.buildCommandesReportHTML = buildCommandesReportHTML;
window.buildClientsReportHTML = buildClientsReportHTML;
window.buildTombolaReportHTML = buildTombolaReportHTML;
