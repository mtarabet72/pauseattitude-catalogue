# Pause Attitude — Catalogue

Site vitrine client : présente la carte des sandwiches Pause Attitude
(photos, description, prix, ingrédients FR/AR, allergènes, valeurs
nutritionnelles). Application 100% front-end, installable comme PWA,
aucune dépendance serveur.

## Contenu à vérifier avant mise en ligne

- **Prix** : les prix affichés dans `js/products.js` (champ `prix_mad`)
  sont des **exemples**. Remplacez-les par les vrais tarifs avant publication.
- **Photos** : le site pointe actuellement vers les photos déjà en ligne
  sur `pauseattitude.ma`. Si ces images changent d'adresse, mettez à jour
  le champ `photo` de chaque produit dans `js/products.js`.
- **Vidéos** : chaque produit a un champ `video` (vide pour l'instant).
  Ajoutez-y une URL de vidéo courte si vous en avez, la fiche technique
  pourra l'afficher.

## Développement local

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Déploiement sur GitHub Pages

1. Créez un nouveau dépôt GitHub, par exemple `pauseattitude-catalogue`.
2. Poussez ce dossier :

   ```bash
   git init
   git add .
   git commit -m "Catalogue Pause Attitude"
   git branch -M main
   git remote add origin https://github.com/<votre-utilisateur>/pauseattitude-catalogue.git
   git push -u origin main
   ```

3. Sur GitHub : **Settings → Pages → Build and deployment**
   - Source : `Deploy from a branch`
   - Branch : `main` / dossier `/ (root)`

4. Le site sera disponible à :
   `https://<votre-utilisateur>.github.io/pauseattitude-catalogue/`

## Structure

```
index.html          page principale (héro, carte, à propos, contact)
manifest.json        déclaration PWA
sw.js                 fonctionnement hors-ligne
css/styles.css        identité visuelle générale
css/fiche.css          fiche technique produit (modale)
js/products.js         données des 7 produits (à modifier ici)
js/app.js               rendu, animations, ouverture des fiches
icons/                  icônes PWA + logo
```
