# Sauvetage CA2 — Parcours, chronométrie & observation (V6)

PWA hors-ligne pour créer, visualiser et chronométrer des parcours de sauvetage aquatique (bassin 25 m).
N'EPS numérique — Académie de Nantes · by Quentin Delisle.

## Structure

```
index.html            Coquille de l'appli (6 écrans : accueil, parcours, éditeur, visualisation, chrono, résultats)
css/app.css           Styles (variables de couleurs en tête de fichier)
js/store.js           Modèle de données, types d'obstacles, modèles intégrés, stockage local, import/migration
js/schema.js          Plan du parcours (toutes les longueurs) — éditeur, vignettes, chrono, fiche PNG
js/sim.js             Animation vue de dessus / vue de côté : départ (plongeon, saut droit, dans l'eau), virage culbute, obstacles
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
- **Entrée dans l'eau** : paramètre du parcours (`entree` : `dive` plongeon, `jump` saut droit, `water` départ dans l'eau), réglé dans l'éditeur, exporté dans le JSON (`data.entree`) ; défaut : plongeon. Affiché dans le résumé et dans l'étape « Départ » du chrono. Les départs et le virage culbute sont des séquences de postures dans `js/sim.js` (`DIVE`, `JUMP`, `WATER`, `TURN`), suivies d'une coulée (`glideOut`).

## V6 — mode enseignant / mode élève

Au premier lancement, l’appareil choisit son rôle (modifiable ensuite ; code enseignant à 4 chiffres, 0000 par défaut).

**Enseignant** (`js/modes.js`, données dans `js/classe.js`, clé `sca2.v6`) :
- Élèves : import de l’appel Pronote (xlsx / csv / copier-coller ; « NOM Prénom » en colonne A ou NOM en A et Prénom en B) → affichage « Prénom N. ».
- Programmation du cycle : nombre de leçons, pilier(s) et consignes de chaque leçon.
- Leçon du jour : appel (absents, inaptes), parcours du jour (existants ou créés), **QR de la leçon** pour les tablettes.
- Récupérer les résultats : scan des QR des tablettes élèves (ou fichier .json).
- Bilan de la leçon, bilan du cycle (fiche individuelle imprimable), export Excel (Synthèse, Passages, Programmation).
- Piliers : banque modifiable — nom, contenus, 3 critères avec leur observable (oui / non).

**Élève** : scanner les infos du cours, contenus du pilier, parcours du jour (animation), chronométrer (choix du nageur + observation des 3 critères à chaque longueur), exporter ses résultats en QR (ou fichier).

**QR** (`js/qr.js`, repris de l’appli Biathlon) : JSON compressé (deflate) + base45 (mode alphanumérique), découpé en plusieurs QR de 300 à 400 caractères qui défilent ; lecture caméra par le détecteur natif, ZXing (WebAssembly, `lib/`) puis jsQR ; secours « photo du QR » et fichier. Morceau : `SV:<S|R>:<id>:<i>:<n>:<données>`.
