# Sauvetage CA2 — V2 (Kit N'EPS, socle 1.0.0)

PWA hors-ligne : parcours de sauvetage aquatique (bassin 25 m), tablette enseignant ↔ tablettes élèves par QR codes.
Quentin Delisle · N'EPS numérique. Reconstruite sur le socle du **Kit N'EPS 1.0.0** à partir de la V6.1.

## Déroulement d'une leçon

1. **Préparer (tablette enseignant)** — Classe & élèves (import Pronote, F/G) → Groupes (automatiques : hétérogènes, par besoin, aléatoire, mixité) → **Paramètres du cycle · leçons** : leçon du jour, nombre de passages, puis le *déroulement* :
   - **Test S1** (leçon 1 par défaut) : 25 / 50 / 100 m, départ ; après la leçon, « 🎯 Vitesses de ce test → cibles » (vitesse de nage de sauveteur = cible) ;
   - ou **Parcours** : parcours du jour (bibliothèque ou création), attribution P1 / P2… par élève ;
   - piliers observés, objectif / consignes.
2. **📲 QR de la leçon** → chaque tablette élève : « Recevoir la leçon » (élèves, groupes, appel, cibles, parcours, piliers, consignes).
3. **Pendant la leçon (tablette élève)** — 🏊 Parcours du jour (animation), 📖 Piliers du jour, ✍️ Saisie → élève → **⏱️ Chronométrer le passage** : parcours, nageur, observateur, pilier observé ; un top par étape (départ, obstacles, virages, arrivée), ❌ obstacle raté, observation des 3 critères (oui / non), enregistrer → « ↔ On inverse » ou passage suivant.
4. **📤 Envoyer mes saisies** (QR) → tablette enseignant : **📥 Récupérer les saisies**.
5. **Bilans** — bilan par leçon (📈 / ⚠️ / 💬, critères collectifs, 📺 projection sans noms), résultats, classement, fils rouges (nageur, observateur ; décision finale de l'enseignant), notes /20, export Excel. **Sauvegarde .json en fin de cycle** (aucune donnée ne quitte les tablettes).

## Fichiers

```
index.html, socle.js, outils.js, styles.css, lib/   socle N'EPS (ne pas modifier)
activite.js        configuration : saisies, piliers par défaut, fils rouges, barème, outils
specifique.js/.css partie propre au sauvetage (programmation, bibliothèque, éditeur, animation, chrono, piliers)
sauvetage/         modules repris de la V6.1 : store.js (parcours), schema.js (plan), sim.js (animation), chrono.js
sw.js, manifest.webmanifest, icons/, .gitlab-ci.yml
```

- Saisies (1 essai = 1 passage) : temps du parcours, vitesse de nage seule (cible = vitesse S1), obstacles ratés, % de critères du pilier observé (calculé), une saisie « critères » par pilier (seules celles des piliers de la leçon s'affichent).
- Détail de chaque passage (parcours, temps par longueur et par obstacle, observateur, pilier) dans `results[n][élève].x[passage]`.
- Note : vitesse (leçons à la cible) 6 · critères des piliers 6 · fil rouge nageur 4 · fil rouge observateur 4 ; les leçons Test S1 ne comptent pas.
- Données : `localStorage` clé `neps_app_sauvetage-ca2-q7v2` (+ `.chrono` pour le passage en cours) ; bibliothèque de parcours `sauv2.library` (les parcours de la V6 présents sur l'appareil sont recopiés au premier lancement).

## Mise en ligne

La Forge (`.gitlab-ci.yml`) ou GitHub Pages. **Toute mise à jour = `version` dans activite.js + `CACHE` dans sw.js augmentés.** Ne jamais changer l'`id` de l'appli.
