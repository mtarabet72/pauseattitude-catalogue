// pro-router.js — Routeur SPA léger pour l'espace Pro.

const ProRouter = (() => {
  const routes = {};

  function register(path, meta, renderFn) {
    routes[path] = { meta, renderFn };
  }

  function normalize(hash) {
    const path = (hash || "").replace(/^#/, "");
    return path && routes[path] ? path : "/articles";
  }

  async function render() {
    const path = normalize(window.location.hash);
    const route = routes[path];

    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${path}`);
    });

    document.getElementById("pro-title").textContent = route.meta.title;
    document.getElementById("pro-subtitle").textContent = route.meta.subtitle;

    const view = document.getElementById("pro-view");
    await route.renderFn(view);
  }

  function start() {
    window.addEventListener("hashchange", render);
    render();
  }

  return { register, start };
})();

window.ProRouter = ProRouter;
