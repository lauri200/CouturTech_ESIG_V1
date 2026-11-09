async function prochainNumero(db, prefixe) {
  const annee = new Date().getFullYear();
  const cle = `${prefixe}-${annee}`;
  const { rows } = await db.query(
    `INSERT INTO compteur (cle, valeur) VALUES ($1, 1)
     ON CONFLICT (cle) DO UPDATE SET valeur = compteur.valeur + 1 RETURNING valeur`,
    [cle],
  );
  return `${cle}-${String(rows[0].valeur).padStart(4, '0')}`;
}

module.exports = { prochainNumero };
