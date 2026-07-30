// app.js — Catalogue Pause Attitude : rendu des produits, animations,
// et fiche technique (modale).

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function emoticonFor(product) {
  return product.halal ? ">>( ° >° )<<" : "}<(((°>";
}

function productCardHTML(product, index) {
  const tilt = index % 2 === 0 ? "-1.6deg" : "1.4deg";
  return `
    <article class="product-card reveal" style="--card-color:${product.couleur};--tilt:${tilt}" data-id="${product.id}" tabindex="0" role="button" aria-label="Voir la fiche de ${escapeHtml(product.nom_fr)}">
      <div class="spine"></div>
      <div class="product-photo">
        <img src="${product.photo}" alt="${escapeHtml(product.nom_fr)}" loading="lazy" />
        ${product.halal ? `<span class="halal-chip">Halal</span>` : ""}
        <span class="price-tag">${product.prix_mad} MAD</span>
      </div>
      <div class="product-body">
        <div class="nom-fr">${escapeHtml(product.nom_fr)}</div>
        <div class="nom-ar">${escapeHtml(product.nom_ar)}</div>
        <p class="tagline">${escapeHtml(product.tagline_fr)}</p>
        <span class="see-more">Voir la fiche →</span>
      </div>
    </article>
  `;
}

function renderGrid() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = PRODUCTS.map(productCardHTML).join("");

  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => openFiche(card.dataset.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFiche(card.dataset.id);
      }
    });
  });
}

function renderTicker() {
  const icons = ["chicken", "tomato", "salad", "cheese", "beef", "fish", "carrots", "eggs"];
  const track = document.getElementById("ticker-track");
  const items = icons
    .map((n) => `<img src="https://pauseattitude.ma/wp-content/uploads/2025/06/icon-${n}.png" alt="" loading="lazy" />`)
    .join("");
  // dupliqué pour un défilement continu sans coupure
  track.innerHTML = items + items;
}

function fondNutrition(label, value, unit) {
  return `<div><span class="label">${label}</span><span class="value">${value ?? "—"}${value != null ? unit : ""}</span></div>`;
}

function ficheHTML(product) {
  return `
    <button class="fiche-close" id="fiche-close" aria-label="Fermer">✕</button>
    <div class="fiche-photo"><img src="${product.photo}" alt="${escapeHtml(product.nom_fr)}" /></div>
    <div class="fiche-header" style="background:${product.couleur}">
      <div class="fiche-emoticon">${escapeHtml(emoticonFor(product))}</div>
      <h3>${escapeHtml(product.nom_fr)}</h3>
      <div class="nom-ar">${escapeHtml(product.nom_ar)}</div>
      <p class="tagline">${escapeHtml(product.tagline_fr)}</p>
      ${product.halal ? `<div class="fiche-halal">Halal</div>` : ""}
    </div>

    <div class="fiche-body">
      <div class="fiche-price-row">
        <span class="fiche-price">${product.prix_mad} MAD</span>
        <span class="fiche-weight">${product.poids_gr} g</span>
      </div>

      <p style="font-size:13.5px;line-height:1.5;color:var(--ink-soft);margin:0">${escapeHtml(product.description_fr)}</p>

      <div class="fiche-cols">
        <div class="fiche-col">
          <h4>Ingrédients (FR)</h4>
          <p>${escapeHtml(product.ingredients_fr)}</p>
        </div>
        <div class="fiche-col rtl">
          <h4>المكونات (AR)</h4>
          <p>${escapeHtml(product.ingredients_ar)}</p>
        </div>
      </div>

      <div class="fiche-nutrition">
        <h4>Valeurs énergétiques (par portion)</h4>
        <div class="fiche-nutrition-grid">
          ${fondNutrition("Énergie", `${product.energie_kj}KJ`, "")}
          ${fondNutrition("Kcal", product.energie_kcal, "")}
          ${fondNutrition("Lipides", product.lipides_g, "g")}
          ${fondNutrition("Sucres", product.sucres_g, "g")}
          ${fondNutrition("Sel", product.sel_g, "g")}
        </div>
      </div>

      <div class="fiche-allergenes">
        <div><strong>Allergènes :</strong> ${escapeHtml(product.allergenes_fr)}</div>
        <div class="ar">${escapeHtml(product.allergenes_ar)}</div>
      </div>
    </div>

    <div class="fiche-footer">
      <a class="btn-cta primary" href="#contact">Commander</a>
    </div>
  `;
}

function openFiche(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;

  const overlay = document.getElementById("fiche-overlay");
  const card = overlay.querySelector(".fiche-card");
  card.innerHTML = ficheHTML(product);
  card.style.position = "relative";

  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  card.querySelector("#fiche-close").addEventListener("click", closeFiche);
}

function closeFiche() {
  const overlay = document.getElementById("fiche-overlay");
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupRevealObserver() {
  const items = document.querySelectorAll(".reveal, .product-card");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

function initApp() {
  renderTicker();
  renderGrid();
  setupRevealObserver();

  const overlay = document.getElementById("fiche-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeFiche();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFiche();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", initApp);
