const LIBELLES = {
  stature: 'Stature', tour_cou: 'Tour de cou', carrure_dos: 'Carrure dos', tour_poitrine: 'Tour de poitrine', sous_poitrine: 'Tour sous poitrine',
  tour_taille: 'Tour de taille', tour_hanches: 'Tour de hanches', longueur_dos: 'Longueur nuque-taille', longueur_manche: 'Longueur de manche',
  tour_bras: 'Tour de bras', tour_poignet: 'Tour de poignet', tour_cuisse: 'Tour de cuisse', entrejambe: 'Longueur d’entrejambe', longueur_jambe: 'Longueur extérieure de jambe',
};

export function TableMesures({ valeurs }) {
  const lignes = Object.keys(LIBELLES).filter((k) => valeurs?.[k] !== undefined);
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
      {lignes.map((k) => <div key={k} className="flex justify-between gap-2 border-b border-nuit/5 py-1"><dt className="text-nuit/60">{LIBELLES[k]}</dt><dd className="font-semibold">{valeurs[k]} cm</dd></div>)}
    </dl>
  );
}

export function SectionMensurations({ mensuration }) {
  if (!mensuration) return null;
  return (
    <section className="carte p-4">
      <h2 className="mb-2 font-semibold">Mensurations du client <span className="text-xs font-normal text-nuit/60">({mensuration.source === 'SCAN' ? 'scan par photos' : 'saisie du client'})</span></h2>
      <TableMesures valeurs={mensuration.valeurs} />
    </section>
  );
}
