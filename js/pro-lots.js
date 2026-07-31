// pro-lots.js — Espace Pro : gestion des lots de la tombola (nom, image,
// stock, % de chance). Écran séparé de la roue elle-même (pro-tombola.js).

function blankLot() {
  return { id: crypto.randomUUID(), nom: "", quantite: 1, image: "", chance: 25 };
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

const ProLotsView = (() => {
  let viewRef = null;
  let pendingLotImage = "";

  async function render(view) {
    viewRef = view;
    await draw();
  }

  async function draw() {
    const view = viewRef;
    const lots = await DB.getAll(DB.STORES.lots);
    lots.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

    view.innerHTML = `
      <div class="pro-card">
        <h3 style="font-family:var(--font-heading);font-size:14px;font-weight:600;margin-bottom:6px">Lots disponibles</h3>
        <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">
          Ajoutez une image (elle apparaîtra sur la roue) et un % de chance. La roue affiche des portions égales,
          mais respecte ces probabilités. Un lot à 0 en stock n'est plus proposé au tirage.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
          <div id="lot-image-preview" style="width:44px;height:44px;border-radius:8px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:10px;color:var(--ink-soft);text-align:center">image</div>
          <label class="pro-btn" style="cursor:pointer;margin:0">
            📷 Image
            <input type="file" id="lot-image-input" accept="image/*" style="display:none" />
          </label>
          <input id="lot-nom" type="text" placeholder="Nom du lot (ex. Sandwich offert)" style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <input id="lot-qte" type="number" min="1" value="1" placeholder="Stock" style="width:80px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <input id="lot-chance" type="number" min="1" max="100" step="1" value="25" placeholder="% chance" title="Pourcentage de chance de gagner ce lot à la roue" style="width:80px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px" />
          <button class="pro-btn pro-btn-primary" id="btn-add-lot">+ Ajouter</button>
        </div>
        <p style="font-size:11.5px;color:var(--ink-soft);margin:0 0 14px">Le <strong>% de chance</strong> est saisi directement par le commercial et n'a pas besoin d'être lié au stock.</p>

        ${
          lots.length === 0
            ? `<p style="font-size:13px;color:var(--ink-soft);margin:0">Aucun lot enregistré.</p>`
            : `<table class="pro-table">
                <thead><tr><th></th><th>Lot</th><th>Stock restant</th><th>Chance</th><th></th></tr></thead>
                <tbody>
                  ${lots
                    .map(
                      (l) => `
                    <tr>
                      <td>${l.image ? `<img src="${l.image}" style="width:32px;height:32px;object-fit:cover;border-radius:6px" />` : "—"}</td>
                      <td>${escapeHtml(l.nom)}</td>
                      <td style="font-family:var(--font-mono)">${l.quantite}</td>
                      <td style="font-family:var(--font-mono)">${l.chance || 0}%</td>
                      <td style="text-align:right"><button class="pro-btn pro-btn-danger" data-del-lot="${l.id}">Supprimer</button></td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>
    `;

    view.querySelector("#lot-image-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingLotImage = await resizeImageToDataURL(file, 160);
      view.querySelector("#lot-image-preview").innerHTML = `<img src="${pendingLotImage}" style="width:100%;height:100%;object-fit:cover" />`;
    });

    view.querySelector("#btn-add-lot").addEventListener("click", async () => {
      const nom = view.querySelector("#lot-nom").value.trim();
      const qte = parseInt(view.querySelector("#lot-qte").value, 10);
      const chance = parseFloat(view.querySelector("#lot-chance").value) || 1;
      if (!nom || !qte || qte <= 0) return;
      await DB.put(DB.STORES.lots, { ...blankLot(), nom, quantite: qte, image: pendingLotImage, chance });
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
  }

  return { render };
})();

window.ProLotsView = ProLotsView;
