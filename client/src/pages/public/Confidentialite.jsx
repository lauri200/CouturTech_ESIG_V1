export default function Confidentialite() {
  const sections = [
    ['Données collectées', 'Nom, prénom, téléphone, e-mail, adresse et quartier (pour la collecte du tissu), contenu de vos commandes et paiements enregistrés par la maison.'],
    ['Utilisation', 'Traiter vos commandes, organiser la collecte de votre tissu, vous envoyer les notifications de suivi (e-mail, SMS) et établir devis et factures. Aucune donnée n’est vendue ni cédée.'],
    ['Accès', 'Le gérant voit vos commandes. Le tailleur voit uniquement le modèle, la taille, le tissu et la deadline : ni votre téléphone, ni votre adresse, ni le prix. Le livreur voit votre adresse et votre téléphone uniquement pour la collecte qui lui est affectée, jusqu’à la remise à l’atelier.'],
    ['Sécurité', 'Mots de passe chiffrés (bcrypt), connexion par jeton sécurisé (JWT), échanges en HTTPS.'],
    ['Durée de conservation', 'Les données sont conservées tant que le compte est actif ; les commandes passées sont conservées pour la comptabilité de CHIDE’S COUTURE.'],
    ['Vos droits', 'Vous pouvez consulter et modifier vos informations dans « Mon profil », et supprimer votre compte lorsqu’aucune commande n’est en cours. Les commandes passées sont alors anonymisées.'],
    ['Contact', 'CHIDE’S COUTURE – Kégué, sur la voie de Kpatcha, Lomé (lundi au samedi, 09h – 21h).'],
  ];
  return (
    <div className="conteneur max-w-3xl py-10">
      <h1 className="titre-section">Politique de confidentialité</h1>
      <div className="mt-6 space-y-5">
        {sections.map(([t, d]) => (
          <section key={t}><h2 className="text-lg font-semibold">{t}</h2><p className="mt-1 text-nuit/80">{d}</p></section>
        ))}
      </div>
    </div>
  );
}
