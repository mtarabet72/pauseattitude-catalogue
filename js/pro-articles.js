// pro-articles.js — Espace Pro : gestion des articles (ajouter, modifier,
// dupliquer, supprimer). Les modifications apparaissent immédiatement
// sur le site public (même base de données locale).

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const PRO_COLORS = [
  { key: "thon", label: "Bleu", hex: "#3F7EA6" },
  { key: "gouda", label: "Jaune", hex: "#E8B23D" },
  { key: "dinde", label: "Brun", hex: "#A9764F" },
  { key: "piquant", label: "Violet", hex: "#4A4785" },
  { key: "andalouse", label: "Orange", hex: "#D9603B" },
  { key: "boeuf", label: "Rouge", hex: "#C23B32" },
];

function blankArticle() {
  return {
    id: crypto.randomUUID(),
    nom_fr: "",
    nom_ar: "",
    tagline_fr: "",
    description_fr: "",
    photo: "",
    video: "",
    couleur: PRO_COLORS[0].hex,
    halal: false,
    prix_mad: "",
    poids_gr: "",
    ingredients_fr: "",
    ingredients_ar: "",
    allergenes_fr: "produit dans un atelier qui utilise tous les allergènes.",
    allergenes_ar: "منتج مُصنّع في ورشة تُستخدم فيها جميع مسببات الحساسية.",
    energie_kj: "",
    energie_kcal: "",
    lipides_g: "",
    satures_g: "",
    sucres_g: "",
    sel_g: "",
  };
}

const ProArticlesView = (() => {
  let mode = "liste";
  let editingId = null;
  let viewRef = null;

  async function render(view) {
    viewRef = view;
    mode = "liste";
    editingId = null;
    await renderList(view);
  }

  async function renderList(view) {
    const articles = await DB.getAll(DB.STORES.articles);
    articles.sort((a, b) => (a.nom_fr || "").localeCompare(b.nom_fr || "", "fr"));

    view.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="pro-btn pro-btn-primary" data-action="nouveau">+ Nouvel article</button>
      </div>

      ${
        articles.length === 0
          ? `<div class="pro-empty">
              <p style="margin:0;font-size:13.5px">Aucun article. Créez-en un pour qu'il apparaisse sur le site public.</p>
              <button class="pro-btn pro-btn-primary" data-action="nouveau">+ Nouvel article</button>
            </div>`
          : `<div class="pro-card" style="padding:0;overflow:auto">
              <table class="pro-table">
                <thead><tr>
                  <th></th><th>Article</th><th>Prix</th><th>Poids</th><th>Halal</th><th></th>
                </tr></thead>
                <tbody>
                  ${articles.map(rowTemplate).join("")}
                </tbody>
              </table>
            </div>`
      }
    `;

    view.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", onListAction));
  }

  function rowTemplate(a) {
    return `
      <tr>
        <td><span class="pro-swatch" style="background:${escapeHtml(a.couleur)}"></span></td>
        <td>
          <div style="font-weight:600">${escapeHtml(a.nom_fr) || "(sans nom)"}</div>
          <div style="color:var(--ink-soft);font-size:12px" dir="rtl">${escapeHtml(a.nom_ar)}</div>
        </td>
        <td style="font-family:var(--font-mono)">${a.prix_mad || "—"} MAD</td>
        <td style="font-family:var(--font-mono)">${a.poids_gr ? a.poids_gr + " g" : "—"}</td>
        <td>${a.halal ? `<span class="pro-badge">Halal</span>` : "—"}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="pro-btn" data-action="modifier" data-id="${a.id}">Modifier</button>
          <button class="pro-btn" data-action="dupliquer" data-id="${a.id}">Dupliquer</button>
          <button class="pro-btn pro-btn-danger" data-action="supprimer" data-id="${a.id}">Supprimer</button>
        </td>
      </tr>
    `;
  }

  async function onListAction(e) {
    const action = e.currentTarget.dataset.action;
    const id = e.currentTarget.dataset.id;

    if (action === "nouveau") {
      editingId = null;
      await renderForm(viewRef);
    } else if (action === "modifier") {
      editingId = id;
      await renderForm(viewRef);
    } else if (action === "dupliquer") {
      const original = await DB.get(DB.STORES.articles, id);
      if (!original) return;
      await DB.put(DB.STORES.articles, { ...original, id: crypto.randomUUID(), nom_fr: `${original.nom_fr} (copie)` });
      await renderList(viewRef);
    } else if (action === "supprimer") {
      const article = await DB.get(DB.STORES.articles, id);
      if (article && confirm(`Supprimer « ${article.nom_fr} » ? Il disparaîtra aussi du site public.`)) {
        await DB.delete(DB.STORES.articles, id);
        await renderList(viewRef);
      }
    }
  }

  async function renderForm(view) {
    const article = editingId ? await DB.get(DB.STORES.articles, editingId) : blankArticle();
    const isNew = !editingId;
    const isPreset = PRO_COLORS.some((c) => c.hex.toLowerCase() === (article.couleur || "").toLowerCase());

    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <button class="pro-btn" data-action="retour">← Retour</button>
        <h2 style="font-family:var(--font-heading);font-size:17px;font-weight:600">${isNew ? "Nouvel article" : "Modifier l'article"}</h2>
      </div>

      <form id="pro-article-form" style="display:flex;flex-direction:column;gap:16px;max-width:820px">

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:14px">Identité</h3>
          <div class="pro-grid-2">
            <label class="pro-field"><span>Nom (FR) *</span><input required name="nom_fr" value="${escapeHtml(article.nom_fr)}" /></label>
            <label class="pro-field"><span>الاسم (AR) *</span><input required dir="rtl" name="nom_ar" value="${escapeHtml(article.nom_ar)}" /></label>
            <label class="pro-field"><span>Accroche (FR)</span><input name="tagline_fr" value="${escapeHtml(article.tagline_fr)}" placeholder="Ex. L'essentiel" /></label>
            <label class="pro-field"><span>Prix (MAD) *</span><input required type="number" min="0" step="0.5" name="prix_mad" value="${escapeHtml(article.prix_mad)}" /></label>
            <label class="pro-field"><span>Poids (gr)</span><input type="number" min="0" name="poids_gr" value="${escapeHtml(article.poids_gr)}" /></label>
            <label class="pro-field"><span>Photo (URL)</span><input name="photo" value="${escapeHtml(article.photo)}" placeholder="https://…" /></label>
            <label class="pro-field"><span>Vidéo (URL, optionnel)</span><input name="video" value="${escapeHtml(article.video)}" placeholder="https://…" /></label>
          </div>

          <label class="pro-field" style="margin-top:12px"><span>Description (FR)</span><textarea name="description_fr" rows="2">${escapeHtml(article.description_fr)}</textarea></label>

          <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
            <input type="checkbox" id="halal-check" name="halal" ${article.halal ? "checked" : ""} />
            <label for="halal-check" style="font-size:13.5px">Halal</label>
          </div>

          <div style="margin-top:14px">
            <span style="font-size:12.5px;color:var(--ink-soft);display:block;margin-bottom:8px">Couleur</span>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              ${PRO_COLORS.map((c) => `
                <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">
                  <input type="radio" name="couleur_choice" value="${c.key}" ${isPreset && article.couleur.toLowerCase() === c.hex.toLowerCase() ? "checked" : ""} />
                  <span class="pro-swatch" style="background:${c.hex}"></span> ${c.label}
                </label>
              `).join("")}
              <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">
                <input type="radio" name="couleur_choice" value="custom" ${!isPreset ? "checked" : ""} />
                Personnalisée
                <input type="color" name="couleur_custom" value="${!isPreset ? article.couleur : "#3F7EA6"}" />
              </label>
            </div>
          </div>
        </div>

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:14px">Ingrédients</h3>
          <div class="pro-grid-2">
            <label class="pro-field"><span>Ingrédients (FR)</span><textarea name="ingredients_fr" rows="5">${escapeHtml(article.ingredients_fr)}</textarea></label>
            <label class="pro-field"><span>المكونات (AR)</span><textarea dir="rtl" name="ingredients_ar" rows="5">${escapeHtml(article.ingredients_ar)}</textarea></label>
          </div>
        </div>

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:14px">Allergènes</h3>
          <div class="pro-grid-2">
            <label class="pro-field"><span>Allergènes (FR)</span><textarea name="allergenes_fr" rows="2">${escapeHtml(article.allergenes_fr)}</textarea></label>
            <label class="pro-field"><span>الحساسية (AR)</span><textarea dir="rtl" name="allergenes_ar" rows="2">${escapeHtml(article.allergenes_ar)}</textarea></label>
          </div>
        </div>

        <div class="pro-card">
          <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:14px">Valeurs énergétiques (par portion)</h3>
          <div class="pro-grid-3">
            <label class="pro-field"><span>Énergie (kJ)</span><input type="number" step="any" name="energie_kj" value="${escapeHtml(article.energie_kj)}" /></label>
            <label class="pro-field"><span>Énergie (kcal)</span><input type="number" step="any" name="energie_kcal" value="${escapeHtml(article.energie_kcal)}" /></label>
            <label class="pro-field"><span>Lipides (g)</span><input type="number" step="any" name="lipides_g" value="${escapeHtml(article.lipides_g)}" /></label>
            <label class="pro-field"><span>Saturés (g)</span><input type="number" step="any" name="satures_g" value="${escapeHtml(article.satures_g)}" /></label>
            <label class="pro-field"><span>Sucres (g)</span><input type="number" step="any" name="sucres_g" value="${escapeHtml(article.sucres_g)}" /></label>
            <label class="pro-field"><span>Sel (g)</span><input type="number" step="any" name="sel_g" value="${escapeHtml(article.sel_g)}" /></label>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center">
          <button type="submit" class="pro-btn pro-btn-primary">Enregistrer</button>
          <button type="button" class="pro-btn" data-action="retour">Annuler</button>
          ${!isNew ? `<button type="button" class="pro-btn pro-btn-danger" data-action="supprimer-form" data-id="${article.id}" style="margin-left:auto">Supprimer cet article</button>` : ""}
        </div>
      </form>
    `;

    view.querySelectorAll('[data-action="retour"]').forEach((btn) => btn.addEventListener("click", async () => {
      mode = "liste";
      await renderList(viewRef);
    }));

    view.querySelector('input[name="couleur_custom"]')?.addEventListener("input", () => {
      view.querySelector('input[name="couleur_choice"][value="custom"]').checked = true;
    });

    view.querySelector('[data-action="supprimer-form"]')?.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const current = await DB.get(DB.STORES.articles, id);
      if (current && confirm(`Supprimer « ${current.nom_fr} » ?`)) {
        await DB.delete(DB.STORES.articles, id);
        mode = "liste";
        await renderList(viewRef);
      }
    });

    view.querySelector("#pro-article-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      const choice = fd.get("couleur_choice");
      const preset = PRO_COLORS.find((c) => c.key === choice);
      const couleur = preset ? preset.hex : fd.get("couleur_custom") || article.couleur;

      const updated = {
        ...article,
        nom_fr: fd.get("nom_fr").trim(),
        nom_ar: fd.get("nom_ar").trim(),
        tagline_fr: fd.get("tagline_fr").trim(),
        description_fr: fd.get("description_fr").trim(),
        photo: fd.get("photo").trim(),
        video: fd.get("video").trim(),
        couleur,
        halal: fd.get("halal") === "on",
        prix_mad: fd.get("prix_mad") ? Number(fd.get("prix_mad")) : "",
        poids_gr: fd.get("poids_gr") ? Number(fd.get("poids_gr")) : "",
        ingredients_fr: fd.get("ingredients_fr").trim(),
        ingredients_ar: fd.get("ingredients_ar").trim(),
        allergenes_fr: fd.get("allergenes_fr").trim(),
        allergenes_ar: fd.get("allergenes_ar").trim(),
        energie_kj: fd.get("energie_kj") ? Number(fd.get("energie_kj")) : "",
        energie_kcal: fd.get("energie_kcal") ? Number(fd.get("energie_kcal")) : "",
        lipides_g: fd.get("lipides_g") ? Number(fd.get("lipides_g")) : "",
        satures_g: fd.get("satures_g") ? Number(fd.get("satures_g")) : "",
        sucres_g: fd.get("sucres_g") ? Number(fd.get("sucres_g")) : "",
        sel_g: fd.get("sel_g") ? Number(fd.get("sel_g")) : "",
      };

      await DB.put(DB.STORES.articles, updated);
      mode = "liste";
      editingId = null;
      await renderList(viewRef);
    });
  }

  return { render };
})();

window.ProArticlesView = ProArticlesView;
