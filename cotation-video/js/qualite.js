/* Décrit la visibilité des repères pour l'interface, sans modifier les angles
   ni les règles de cotation. Un repère visible ne garantit pas sa précision. */

const SEGMENTS = [
  { cle: "tronc", libelle: "Tronc" },
  { cle: "cou", libelle: "Cou" },
  { cle: "bras", libelle: "Bras évalué" },
  { cle: "jambes", libelle: "Jambes" },
  { cle: "poignet", libelle: "Poignet" }
];

/**
 * @returns {{etat: string, titre: string, description: string,
 *   cote: ('G'|'D'|null), segments: Array, avertissements: string[]}}
 * Les états portent sur les repères affichés, jamais sur la validité du score.
 */
export function decrireQualite(image, { demo = false, seuil = 0.5 } = {}) {
  if (demo) {
    return {
      etat: "demo",
      titre: "Postures simulées",
      description: "Cet exemple sert à découvrir l'outil. Les postures et les scores sont simulés.",
      cote: image?.angles?.cote || null,
      segments: SEGMENTS.map(s => ({ ...s, etat: "simule", detail: "Repères simulés" })),
      avertissements: ["Aucune mesure provenant d'une photo ou d'une vidéo."]
    };
  }

  if (!image) {
    return {
      etat: "attente",
      titre: "En attente d'une analyse",
      description: "Importez une photo ou une vidéo pour examiner les repères détectés.",
      cote: null,
      segments: SEGMENTS.map(s => ({ ...s, etat: "inconnu", detail: "Aucune observation" })),
      avertissements: []
    };
  }

  const angles = image.angles || {};
  const visibilite = angles.fiabilite?.visibilite || {};
  const cote = ["G", "D"].includes(angles.cote) ? angles.cote : null;
  const borne = Number.isFinite(seuil) ? seuil : 0.5;
  const visible = valeur => Number.isFinite(valeur) && valeur >= borne;
  const decrireRepere = (cle, libelle, valeur) => ({
    cle, libelle,
    etat: visible(valeur) ? "visible" : "a_verifier",
    detail: visible(valeur) ? "Repères visibles"
      : Number.isFinite(valeur) ? "Repères peu visibles" : "Visibilité non disponible"
  });

  // Le meilleur des deux bras ne dit rien du bras effectivement retenu.
  const segments = [
    decrireRepere("tronc", "Tronc", visibilite.tronc),
    decrireRepere("cou", "Cou", visibilite.cou),
    decrireRepere("bras", cote ? `Bras ${cote === "G" ? "gauche" : "droit"}` : "Bras évalué",
      cote ? visibilite[`bras${cote}`] : undefined)
  ];

  const jambesDeclarees = image.avertissements?.includes("jambes") || false;
  const jambes = jambesDeclarees
    ? { cle: "jambes", libelle: "Jambes", etat: "declare",
        detail: "Position déclarée · repères insuffisants" }
    : angles.jambesObservables === false
      ? { cle: "jambes", libelle: "Jambes", etat: "a_verifier",
          detail: "Repères insuffisants · mesure à vérifier" }
      : decrireRepere("jambes", "Jambes", visibilite.jambes);
  segments.push(jambes, {
    cle: "poignet", libelle: "Poignet", etat: "a_verifier",
    detail: "Angle approximatif · à vérifier visuellement"
  });

  const avertissements = [];
  if (segments[0].etat !== "visible") avertissements.push("Vérifiez le cadrage du tronc et des hanches.");
  if (segments[1].etat !== "visible") avertissements.push("Vérifiez les repères du cou et de la tête.");
  if (segments[2].etat !== "visible") {
    avertissements.push(cote
      ? `Le bras ${cote === "G" ? "gauche" : "droit"} retenu pour la cotation présente des repères à vérifier.`
      : "Le côté évalué n'est pas disponible.");
  }
  if (jambesDeclarees) avertissements.push("La cotation des jambes utilise la position déclarée dans les paramètres.");
  else if (jambes.etat !== "visible") avertissements.push("Vérifiez le cadrage des jambes ou renseignez leur position.");
  avertissements.push("Le poignet reste à vérifier visuellement, même lorsque le bras est visible.");

  // Le poignet impose toujours une vérification, sans faire passer l'ensemble
  // des repères pour une détection insuffisante à chaque image.
  const aVerifier = segments.slice(0, 4).some(s => s.etat !== "visible");
  return {
    etat: aVerifier ? "a_verifier" : "visible",
    titre: aVerifier ? "Repères à vérifier" : "Repères visibles",
    description: "La visibilité décrit les repères détectés. Elle ne garantit ni l'exactitude des angles ni la validité du score.",
    cote, segments, avertissements
  };
}
