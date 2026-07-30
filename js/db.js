// db.js — Stockage local (IndexedDB) partagé entre le catalogue public
// et l'espace Pro. Fonctionne hors-ligne, aucune donnée envoyée à un serveur.

const DB_NAME = "pauseattitude-catalogue-db";
const DB_VERSION = 1;

const STORES = {
  articles: "articles",
  clients: "clients",
  commandes: "commandes",
  reclamations: "reclamations",
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.articles)) {
        db.createObjectStore(STORES.articles, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.clients)) {
        db.createObjectStore(STORES.clients, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.commandes)) {
        db.createObjectStore(STORES.commandes, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.reclamations)) {
        db.createObjectStore(STORES.reclamations, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

function tx(storeName, mode = "readonly") {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  STORES,

  async getAll(storeName) {
    const store = await tx(storeName);
    return promisify(store.getAll());
  },

  async get(storeName, key) {
    const store = await tx(storeName);
    return promisify(store.get(key));
  },

  async put(storeName, value) {
    const store = await tx(storeName, "readwrite");
    return promisify(store.put(value));
  },

  async delete(storeName, key) {
    const store = await tx(storeName, "readwrite");
    return promisify(store.delete(key));
  },

  async count(storeName) {
    const store = await tx(storeName);
    return promisify(store.count());
  },

  // Copie les produits de départ (js/products.js) dans la base la toute
  // première fois, pour que l'espace Pro ait quelque chose à éditer.
  async seedIfEmpty() {
    const existing = await this.count(STORES.articles);
    if (existing > 0) return;
    if (!window.PRODUCTS) return;

    for (const product of window.PRODUCTS) {
      await this.put(STORES.articles, { ...product });
    }
  },
};

window.DB = DB;
