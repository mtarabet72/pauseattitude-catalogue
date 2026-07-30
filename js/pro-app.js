// pro-app.js — Bootstrap de l'espace Pro.

function comingSoon(title, description) {
  return async (view) => {
    view.innerHTML = `
      <div class="pro-empty">
        <h2 style="font-family:var(--font-heading);font-size:16px;font-weight:600;color:var(--ink);margin:0">${title}</h2>
        <p style="margin:0;font-size:13.5px;max-width:48ch">${description}</p>
      </div>
    `;
  };
}

async function initPro() {
  await DB.seedIfEmpty();

  ProRouter.register(
    "/articles",
    { title: "Articles", subtitle: "Gérez la carte affichée sur le site public." },
    ProArticlesView.render
  );

  ProRouter.register(
    "/clients",
    { title: "Clients & tarifs", subtitle: "Fiches clients et paliers de prix négociés par quantité." },
    comingSoon(
      "Bientôt disponible",
      "Fiche client et grille de tarifs dégressifs (ex. 20-29 unités → prix négocié) — prochaine étape."
    )
  );

  ProRouter.register(
    "/fidelite",
    { title: "Fidélité & tombola", subtitle: "Points de fidélité et tirage au sort." },
    comingSoon(
      "Bientôt disponible",
      "Suivi des points de fidélité par client et tirage au sort de la tombola — prochaine étape."
    )
  );

  ProRouter.register(
    "/reclamations",
    { title: "Réclamations", subtitle: "Suivi des réclamations clients." },
    comingSoon(
      "Bientôt disponible",
      "Enregistrement et suivi des réclamations clients (motif, statut, date) — prochaine étape."
    )
  );

  ProRouter.start();
}

document.addEventListener("DOMContentLoaded", initPro);
