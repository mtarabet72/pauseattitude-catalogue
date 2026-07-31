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
    "/commandes",
    { title: "Commandes", subtitle: "Préparez et suivez les commandes de vos clients." },
    ProCommandesView.render
  );

  ProRouter.register(
    "/clients",
    { title: "Clients & tarifs", subtitle: "Fiches clients et paliers de prix négociés par quantité." },
    ProClientsView.render
  );

  ProRouter.register(
    "/fidelite",
    { title: "Fidélité", subtitle: "Points de fidélité par client." },
    ProFideliteView.render
  );

  ProRouter.register(
    "/lots",
    { title: "Lots", subtitle: "Gérez les lots proposés à la tombola (image, stock, % de chance)." },
    ProLotsView.render
  );

  ProRouter.register(
    "/tombola",
    { title: "Tombola", subtitle: "La roue et l'historique des tirages." },
    ProTombolaView.render
  );

  ProRouter.register(
    "/reclamations",
    { title: "Réclamations", subtitle: "Suivi des réclamations clients." },
    comingSoon(
      "Bientôt disponible",
      "Enregistrement et suivi des réclamations clients (motif, statut, date) — prochaine étape."
    )
  );

  ProRouter.register(
    "/parametres",
    { title: "Paramètres", subtitle: "Sauvegarde, restauration, réinitialisation et rapports." },
    ProParametresView.render
  );

  ProRouter.start();
}

document.addEventListener("DOMContentLoaded", initPro);
