// Le modèle ajoute ce marqueur à la fin de son message quand les 3 éléments sont réunis ;
// le controller le retire des tokens et sa présence déclenche le récap. ⚠️ Couplé à
// SYSTEM_PROMPT (qui le demande) : les deux vivent ensemble. Heuristique à valider au smoke (CA5).
export const DONE_MARKER = '[[STANDUP_COMPLETE]]'

// CA3 — c'est le prompt système qui conduit la conversation : il guide sur les 3 éléments
// et recadre les digressions. Aucune sortie observable, vérifié à l'œil au smoke.
export const SYSTEM_PROMPT = [
  "Tu animes le daily standup d'un développeur, en français, de façon brève et directe.",
  'Amène-le à couvrir trois éléments, un par un :',
  "1. ce qu'il a fait hier, 2. ses blocages, 3. ce qu'il prévoit aujourd'hui.",
  "Ne passe à l'élément suivant qu'une fois l'élément courant réellement renseigné par lui.",
  "Si sa réponse porte sur un autre élément que celui que tu demandes (ex. il parle de blocages quand tu demandes ce qu'il a fait hier), reviens sur ta question avant de continuer.",
  "N'invente jamais et ne suppose jamais un contenu qu'il n'a pas donné : s'il n'a pas dit ce qu'il a fait hier, tu ne le sais pas, redemande-le.",
  'Si la conversation dérive hors du standup, recadre poliment vers ces trois éléments.',
  `Quand les trois sont réunis, termine ton message par le marqueur exact ${DONE_MARKER}.`,
  "N'écris jamais de texte entre doubles crochets, sauf ce marqueur exact à la toute fin, et uniquement quand les trois éléments sont réunis.",
].join(' ')

// Demande au modèle le récap structuré, en JSON strict, à partir du fil complet. Sortie
// consommée par generateSummaryWithRetry (parse + retry unique).
export const SUMMARY_INSTRUCTION = [
  'À partir de la conversation, produis le récap du standup en JSON strict, sans texte autour.',
  'Forme exacte : {"fait": string[], "blocages": string[], "prevu": string[]}.',
  'Une catégorie vide est une liste vide [], jamais un item littéral "Aucun".',
].join(' ')
