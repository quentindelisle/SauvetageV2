# Sauvetage CA2 — Parcours & Chronométrie (V5)

PWA hors-ligne pour créer, visualiser et chronométrer des parcours de sauvetage aquatique (bassin 25 m).
N'EPS numérique — Académie de Nantes · by Quentin Delisle.

## Structure

```
index.html            Coquille de l'appli (6 écrans : accueil, parcours, éditeur, visualisation, chrono, résultats)
css/app.css           Styles (variables de couleurs en tête de fichier)
js/store.js           Modèle de données, types d'obstacles, modèles intégrés, stockage local, import/migration
js/schema.js          Plan du parcours (toutes les longueurs) — éditeur, vignettes, chrono, fiche PNG
js/sim.js             Animation vue de dessus / vue de côté (moteur repris de la V4c)
js/chrono.js          Logique de chronométrage (étapes, taps, annulation, calcul des temps)
js/export.js          Export JSON (parcours), CSV (résultats), fiche PNG élève
js/app.js             Navigation (#/home, #/library…) et interfaces
sw.js                 Service worker (hors-ligne) — changer CACHE_VERSION à chaque mise en ligne
assets/logo.jpg       Logo N'EPS
icons/                Icônes PWA
```

## Points clés

- **Ajouter un type d'obstacle** : `TYPES` dans `js/store.js`, pictogramme dans `Schema.icon` (`js/schema.js`), comportement d'animation dans `js/sim.js` (`beginAction`, `swimmerState`, `drawObstacles*`).
- **Modèles intégrés** : `BUILTIN_RAW` dans `js/store.js`.
- **Chrono** : la liste des étapes est déduite du parcours (`Chrono.steps`). Chaque tap horodate l'étape suivante ; « Annuler » retire le dernier tap. Le chrono repose sur l'heure de départ : il survit à un rechargement ou à une mise en veille.
- **Stockage** (localStorage, propre à chaque appareil) : `sca2.library`, `sca2.current`, `sca2.chrono`, `sca2.results`, `sca2.settings`.
- **Compatibilité** : les fichiers `.json` exportés par la V4c s'importent tels quels ; les fichiers exportés par la V5 gardent le même format `data.nbLongueurs / data.obstacles`.
- **Raccourcis chrono** (clavier ou télécommande de présentation Bluetooth) : Espace / Entrée / Page suivante = tap · Page précédente / ← = annuler · F = faute.
