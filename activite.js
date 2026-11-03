/* =====================================================================
   ACTIVITÉ — Sauvetage CA2 (V2 sur le socle N'EPS 1.0.0)
   Le seul fichier de configuration propre à l'appli. Les parties hors socle
   (parcours, animation, chrono par étapes, Test S1, piliers) sont dans
   specifique.js et sauvetage/ (modules repris de la V6.1).
   ===================================================================== */

/* ---------- Banque de piliers par défaut (modifiable dans l'appli : Espace enseignant → Piliers) ----------
   Un pilier = un nom (n), des contenus (c : ce que l'élève doit faire, une ligne par contenu)
   et 3 critères (t) avec leur observable (o : ce que l'observateur voit, oui / non). */
window.SAUV_PILIERS = [
  { id:'alignement', n:'Alignement du nageur', c:"Je m'allonge à la surface : tête, bassin et pieds sur une même ligne.\nJe gaine le ventre et les fesses pour que mes jambes ne coulent pas.\nMes jambes battent fin et dans l'axe, sans grands mouvements de côté.",
    cr:[ {t:'Corps horizontal', o:"Hanches et talons près de la surface : les jambes ne coulent pas"},
         {t:'Axe tête-bassin-pieds', o:"Le corps reste droit, il ne serpente pas de droite à gauche"},
         {t:'Gainage', o:"Jambes serrées, battements fins : les pieds ne sortent pas en grand de l'eau"} ] },
  { id:'regard', n:'Regard et placement de la tête', c:"Je regarde le fond, juste devant moi, la nuque relâchée.\nMa tête reste dans l'axe : je ne la relève pas pour regarder devant.\nPour respirer, je tourne la tête sur le côté, une oreille dans l'eau.",
    cr:[ {t:'Regard vers le fond', o:"Regarde le fond, devant lui (on voit le dessus du bonnet)"},
         {t:'Tête dans l’axe', o:"Ne relève pas la tête pour regarder devant pendant la nage"},
         {t:'Respiration latérale', o:"Inspire en tournant la tête sur le côté, une oreille dans l'eau"} ] },
  { id:'coulee', n:'Coulée', c:"Après le départ et chaque virage, je fais la flèche : bras tendus, mains l'une sur l'autre, tête serrée entre les bras.\nJe glisse sous l'eau, sans remonter tout de suite, au-delà de la marque des 5 m.\nJe reprends la nage en commençant par les jambes, sans m'arrêter.",
    cr:[ {t:'Flèche', o:"Bras tendus, mains superposées, tête serrée entre les bras"},
         {t:'Glisse sous l’eau', o:"Reste sous la surface et dépasse la marque des 5 m"},
         {t:'Reprise de nage', o:"Bat des jambes avant de ralentir, remonte en douceur sans s'arrêter"} ] },
  { id:'entree', n:"Entrer dans l'eau", c:"Je pars dès le signal.\nJ'entre dans l'eau corps gainé (tête ou pieds en premier selon le départ).\nJ'enchaîne directement avec une coulée, sans m'arrêter.",
    cr:[ {t:'Réaction au signal', o:"Part dès le signal, sans hésiter"},
         {t:'Corps gainé', o:"Corps droit et serré à l'entrée dans l'eau"},
         {t:'Enchaînement', o:"Enchaîne coulée puis nage sans s'arrêter"} ] },
  { id:'virage', n:'Virage efficace', c:"J'arrive au mur sans ralentir.\nJe pose les pieds au mur, jambes fléchies, et je pousse fort.\nJe repars en coulée, sous l'eau.",
    cr:[ {t:'Continuité', o:"Ne s'arrête pas au mur (aucune pause)"},
         {t:'Appui au mur', o:"Pieds posés au mur, jambes fléchies, poussée franche"},
         {t:'Départ en coulée', o:"Repart sous l'eau, bras tendus devant"} ] },
  { id:'immersion', n:"S'immerger et franchir les obstacles", c:"Je plonge en canard : tête la première, jambes à la verticale.\nJe passe dans le cerceau sans le toucher.\nJe remonte en regardant où je vais.",
    cr:[ {t:'Plongeon canard', o:"Tête la première, jambes à la verticale hors de l'eau"},
         {t:'Franchissement', o:"Passe l'obstacle sans le toucher ni s'arrêter"},
         {t:'Remontée orientée', o:"Remonte en regardant devant, dans la bonne direction"} ] },
  { id:'remorquage', n:'Ramasser et remorquer', c:"Je descends saisir l'objet ou le mannequin du premier coup.\nJe garde la tête du mannequin hors de l'eau.\nJe remorque sur le dos avec des battements réguliers.",
    cr:[ {t:'Saisie', o:"Saisit l'objet ou le mannequin du premier coup"},
         {t:'Tête hors de l’eau', o:"Visage du mannequin toujours hors de l'eau"},
         {t:'Propulsion', o:"Battements de jambes réguliers, sans s'arrêter"} ] },
  /* deux emplacements libres : à renommer et compléter dans l'appli (Piliers) */
  { id:'libre1', n:'Pilier libre 1', libre:true, c:'', cr:[ {t:'Critère 1', o:''}, {t:'Critère 2', o:''}, {t:'Critère 3', o:''} ] },
  { id:'libre2', n:'Pilier libre 2', libre:true, c:'', cr:[ {t:'Critère 1', o:''}, {t:'Critère 2', o:''}, {t:'Critère 3', o:''} ] },
];

window.APP_CONFIG = {
  /* ---------- Identité ---------- */
  id: 'sauvetage-ca2-q7v2',          // NE JAMAIS CHANGER après diffusion : sépare les données et filtre les QR
  name: 'Sauvetage CA2',
  short: 'Sauvetage CA2',
  sub: 'CA2 · Parcours de sauvetage aquatique (bassin 25 m)',
  author: 'Quentin Delisle',
  color: '#0062C4',
  accent: '#F59A1B',
  version: '1.1.0',                  // à augmenter à chaque mise en ligne (sw.js : CACHE)

  /* ---------- Organisation ---------- */
  mode: 'cycle',
  lessons: 6,                        // leçon 1 = Test S1 (réglable dans Paramètres du cycle)
  attempts: 2,                       // passages chronométrés par élève et par leçon
  maxGroups: 8,                      // groupes de couleur = tablettes
  sexe: true,

  /* ---------- Saisies (1 essai = 1 passage) ----------
     Les passages sont remplis par le chrono de parcours (specifique.js) ; les cases restent corrigeables à la main. */
  fields: [
    { id:'tps', label:'Temps du parcours', type:'number', per:'try', unit:'s', step:0.1, dec:1, min:0, max:0, agg:'best', better:'low',
      help:'Temps total du passage, rempli par le chrono de parcours.' },
    { id:'vit', label:'Vitesse de nage seule', type:'number', per:'try', unit:'m/s', step:0.01, dec:2, min:0, max:0, agg:'mean', better:'high', target:true,
      help:'Nage hors obstacles. Cible = vitesse de nage de sauveteur mesurée au Test S1.' },
    { id:'rat', label:'Obstacles ratés', type:'counter', per:'try', min:0, max:10, step:1, agg:'sum', better:'low', dec:0,
      help:'Fautes notées pendant le passage (obstacle raté, mannequin lâché…).' },
    { id:'pil', label:'Critères du pilier observé', type:'number', per:'try', unit:'%', min:0, max:100, step:1, dec:0, agg:'mean', better:'high', show:false,
      help:'Calculé automatiquement : % des 3 critères validés par l\'observateur.' },
    /* une saisie « critères » par pilier : seules celles des piliers programmés dans la leçon s'affichent */
    ...window.SAUV_PILIERS.map(p => ({ id:'P_' + p.id, label:'Pilier · ' + p.n, type:'criteres', per:'try', criteres:p.cr.map(x => x.t) })),
  ],

  /* ---------- Rôles : nageur / observateur choisis à chaque passage dans le chrono (pas de rotation du socle) ---------- */
  roles: [],

  /* ---------- Fils rouges (règles de la V6.1, calculées dans specifique.js) ---------- */
  filsRouges: [
    { id:'FN', nom:'Fil rouge · Nageur', ico:'🧶', couleur:'#D0161B',
      regle:{ type:'fonction', calcul:(n, sid) => window.SAUV.frNageur(n, sid) },
      explication:'Ne rater aucun obstacle et garder une vitesse de nage stable, proche de sa vitesse de sauveteur (Test S1). Écart moyen ≤ 5 % → très bonne ; ≤ 10 % → satisfaisante ; ≤ 20 % → fragile ; au-delà → insuffisante. Un obstacle raté par passage en moyenne retire un niveau, plus d\'un en retire deux.' },
    { id:'FO', nom:'Fil rouge · Observateur', ico:'🧵', couleur:'#1E5FD8',
      regle:{ type:'fonction', calcul:(n, sid) => window.SAUV.frObservateur(n, sid) },
      explication:'Rester concentré pour aider son partenaire : observer et renseigner les 3 critères du pilier sur les passages observés. 95 % des critères renseignés → très bonne ; 80 % → satisfaisante ; 50 % → fragile ; aucun passage observé ou moins de 50 % → insuffisante.' },
  ],

  /* ---------- Note sur 20 (les leçons Test S1 ne comptent pas) ---------- */
  grade: { on:true, total:20, items:[
    { field:'vit', from:'cible', pts:6, table:[[0,0],[100,6]], label:'Vitesse : leçons à la cible' },
    { field:'pil', from:'mean', pts:6, table:[[0,0],[100,6]], label:'Critères des piliers réussis' },
    { field:'fr:FN', pts:4, table:[[1,0],[4,4]], label:'Fil rouge nageur' },
    { field:'fr:FO', pts:4, table:[[1,0],[4,4]], label:'Fil rouge observateur' } ] },

  /* ---------- Outils de séance ---------- */
  tools: {
    tirage:{ on:true, el:false },
  },
};
