// Grille de la maison : bornes hautes (cm) de poitrine, taille et hanches pour chaque taille.
const GRILLE_DEFAUT = 'S:88/70/94,M:92/74/98,L:96/78/102,XL:102/84/108,2XL:108/90/114,3XL:114/96/120';

function lireGrille(texte = GRILLE_DEFAUT) {
  return String(texte).split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [taille, b] = x.split(':');
    const [poitrine, tour, hanches] = (b || '').split('/').map(Number);
    return { taille: taille.trim(), poitrine, taille_cm: tour, hanches };
  }).filter((l) => l.taille && [l.poitrine, l.taille_cm, l.hanches].every(Number.isFinite));
}

// Taille conseillée = la plus petite taille qui contient toutes les mesures connues.
function tailleConseillee(valeurs, grilleTexte, disponibles) {
  const grille = lireGrille(grilleTexte).filter((l) => !disponibles || disponibles.includes(l.taille));
  if (!grille.length || !valeurs) return null;
  const v = { poitrine: valeurs.tour_poitrine, taille_cm: valeurs.tour_taille, hanches: valeurs.tour_hanches };
  if (![v.poitrine, v.taille_cm, v.hanches].some(Number.isFinite)) return null;
  const ok = grille.find((l) => ['poitrine', 'taille_cm', 'hanches'].every((k) => !Number.isFinite(v[k]) || v[k] <= l[k]));
  return (ok || grille[grille.length - 1]).taille;
}

module.exports = { GRILLE_DEFAUT, lireGrille, tailleConseillee };
