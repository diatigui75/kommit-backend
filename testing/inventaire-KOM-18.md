# Inventaire de tests : KOM-18 « Renseigner son daily standup · backend »

Source : ticket KOM-18 (copie fidèle de la page Notion, `assets/KOM-18/ticket.md`), prompts fournis par le ticket (`assets/KOM-18/standupPrompts.ts`), contrat `src/types/apiContract.ts`. Doctrine appliquée : `docs/testing-strategy.md`.

Les paquets et leur ordre sont ceux du ticket.

Contraintes techniques prises en compte :

- Le serveur calcule le jour en Europe/Paris, fuseau fixe ; l'horloge est injectable dans les tests (le CI tourne en UTC). Le `POST /standups` ne porte pas de date.
- Entité `Standup` à poser dans `schema.prisma`, colonne « jour » à trancher entre `@db.Date` et `DateTime`, contrainte `UNIQUE (userId, jour)`. L'unicité est tenue par la base, pas par un `if` applicatif.
- Forme du récap `{ fait: string[], blocages: string[], prevu: string[] }`, catégorie vide = liste vide, jamais « Aucun ».
- Serveur sans état : le front renvoie tout l'historique à chaque tour, et le récap reçu au moment de valider.
- Flux SSE authentifié par le cookie de session de F1 (CORS avec credentials), pas de JWT.
- Prompts imposés : `SYSTEM_PROMPT`, `SUMMARY_INSTRUCTION`, et le marqueur `DONE_MARKER` (`[[STANDUP_COMPLETE]]`) que le modèle ajoute en fin de message et que le serveur retire des tokens. Le fichier précise lui-même que cette heuristique est à valider au smoke.
- Une sortie du LLM hors format attendu est à gérer par le backend (retry unique puis `SUMMARY_MALFORMED`).

### 1. La conversation avec l'IA, en streaming

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA2, CA4 | La réponse de Groq est relayée au fil de l'eau en événements SSE `token`, sans le marqueur `DONE_MARKER` | 🟠 | La transformation « fragments du stream Groq → événements `token` », avec retrait du marqueur (y compris s'il arrive coupé sur 2 fragments), est du code à nous, testée sur un stream mocké. Reste une tranche réelle : la forme des fragments du SDK Groq est mockée, et le « au fil de l'eau » dépend du branchement SSE réel (en-têtes `text/event-stream`, envoi sans mise en tampon par Express ou une compression) | Unitaire (stream mocké → suite d'événements `token`, marqueur retiré) + smoke manuel : `curl -N` sur `POST /standups/conversation` avec cookie, vérifier `200 text/event-stream` et des événements `token` qui arrivent un par un, jamais le texte `[[STANDUP_COMPLETE]]` |
| CA39 | Un message vide ou composé uniquement d'espaces est refusé en `VALIDATION_ERROR` | 🟢 | Décision prise par le schéma Zod du corps `PostConversationBody`, monté via `validateBody` sur notre propre route, qui refuse en `400` avant le handler, donc avant l'ouverture du flux | Unitaire, test-first |
| CA3 | La conversation guide sur les 3 éléments (hier, blocages, aujourd'hui) et recadre les digressions | 🔴 | Le ticket le dit : aucune sortie observable. Le comportement est celui du modèle sous `SYSTEM_PROMPT` ; un test unitaire ne pourrait que vérifier que le prompt est passé, pas que le modèle guide | Manuel (smoke) : conversation réelle avec une digression et une réponse qui saute un élément, vérifier à l'œil que l'IA recadre et redemande |
| CA5 | En fin de conversation, le serveur émet un événement `summary` avec le récap en 3 catégories | 🟠 | La logique « marqueur détecté → appel de résumé avec `SUMMARY_INSTRUCTION` → JSON parsé → événement `summary` », et l'absence de `summary` sans marqueur, sont du code à nous, testés avec un LLM mocké. Reste la tranche réelle que le fichier de prompts signale : que le vrai modèle émette bien le marqueur quand les 3 éléments sont réunis, et rende un JSON que notre parsing accepte (sans bloc de code autour, par exemple) | Unitaire (marqueur présent → `summary` ; marqueur absent → pas de `summary`) + smoke manuel : conversation complète sur les 3 éléments, vérifier qu'un seul événement `summary` arrive, avec `fait`, `blocages`, `prevu` en listes et `[]` pour une catégorie vide (pas « Aucun ») |

### 2. L'enregistrement du standup du jour

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA1, CA8 | `GET /standups/today` dit si le standup du jour est fait et le renvoie, « aujourd'hui » étant calculé par le serveur en Europe/Paris | 🟠 | Le calcul du jour avec une horloge injectée et la décision `done: true` + standup / `done: false` + `null` sont du code à nous, testés avec un repository mocké. Reste la lecture réelle en base par `(userId, jour)`, dont le résultat dépend de la façon dont Prisma stocke et relit la colonne « jour » | Unitaire (calcul du jour, décision `done`) + smoke manuel : `GET /standups/today` avant validation → `{ done: false, standup: null }`, puis après `POST /standups` → `{ done: true, standup }` avec le jour du jour |
| CA6 | À la validation, le récap est réellement enregistré pour le jour courant | 🔴 | L'écriture réelle de la ligne `Standup` (relation à `User`, colonne jour, récap) est le comportement de Prisma et du schéma. Le calcul du jour et le contenu transmis sont déjà couverts en unitaire par CA35 et CA26 | Manuel (smoke) : `POST /standups` avec cookie et un récap valide, vérifier la ligne en base (bon `userId`, bon jour, récap identique) et la réponse `Standup` |
| CA26 | Le récap persisté est celui envoyé par le front, validé sur sa forme (Zod), sans regénération | 🟢 | Le schéma Zod de `StandupSummary` (3 listes de chaînes, catégorie manquante refusée) et le fait que le service transmet ce récap tel quel au repository, sans appeler le LLM, sont du code à nous, testés avec un repository mocké | Unitaire, test-first |
| CA35 | Un standup validé à 00h30 heure de Paris est daté du jour civil local ; une date envoyée par le client est ignorée | 🟠 | Le calcul du jour civil Paris à partir d'une horloge injectée (00h30 Paris = 23h30 UTC la veille, avec heure d'été et d'hiver) et l'absence de date dans le corps validé sont du code à nous. Reste une tranche réelle liée à la contrainte « trancher `@db.Date` vs `DateTime` » : la conversion du jour en date stockée par Prisma peut décaler d'un jour (minuit Paris = veille en UTC), quelle que soit l'heure du test | Unitaire (horloge injectée : 00h30 Paris, 23h59 Paris, changement d'heure ; champ `jour` du corps ignoré) + smoke manuel : `POST /standups` avec un champ `jour` d'un autre jour dans le corps, vérifier en base et dans la réponse que le jour est celui d'aujourd'hui à Paris, sans décalage |

### 3. Unicité : un seul standup par jour

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA9 | Resoumettre le même jour remplace le standup, n'en ajoute pas un second | 🔴 | La contrainte technique dit que c'est la contrainte `UNIQUE (userId, jour)` et l'écriture atomique (upsert) en base qui le garantissent, pas un `if`. Le mocker reviendrait à mocker exactement ce qu'on vérifie | Manuel (smoke) : 2 `POST /standups` le même jour avec 2 récaps différents, vérifier une seule ligne en base pour ce `(userId, jour)`, portant le second récap ; idem en lançant les 2 requêtes en parallèle |

### 4. Les erreurs du flux et l'accès

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA29 | Une sortie de résumé non conforme est retentée une fois, avec rappel de la forme ; un second échec émet `SUMMARY_MALFORMED` et jamais de `summary` | 🟢 | Le parsing, la validation de forme, le retry unique et la décision `summary` vs `SUMMARY_MALFORMED` sont du code à nous ; la sortie du LLM est une chaîne qu'on mocke sans dépendre d'une forme d'erreur de la lib. Qu'aucun standup malformé ne s'enregistre est tenu par le schéma Zod du `POST` (CA26) | Unitaire, test-first (JSON cassé puis valide → `summary` ; 2 sorties cassées → `SUMMARY_MALFORMED`, LLM appelé 2 fois, pas plus ; catégorie manquante traitée comme non conforme) |
| CA31, CA32 | Une erreur pendant le flux (quota, provider indisponible, timeout) part en événement SSE `error` avec `LLM_QUOTA_EXCEEDED` ou `LLM_UNAVAILABLE` | 🟠 | Le mapping des erreurs du SDK Groq (429 → `LLM_QUOTA_EXCEEDED`, 500 / 503 / timeout → `LLM_UNAVAILABLE`) et l'émission d'un événement `error` au lieu d'un code HTTP sont du code à nous, testés en mockant ces erreurs. Ces formes d'erreur mockées ne sont confirmées par aucun smoke existant, et une erreur levée après l'envoi des en-têtes doit réellement sortir dans le flux, pas finir dans `errorHandler` | Unitaire (mapping des 3 formes d'erreur, erreur pendant le stream → événement `error`) + smoke manuel : provider injoignable ou timeout très court, vérifier `200 text/event-stream` puis un événement `error` `LLM_UNAVAILABLE` ; le quota (429) n'est pas provocable à la demande, il reste couvert par l'unitaire seul |
| (sans numéro) | Sans session valide, le serveur répond 401 avant d'ouvrir le flux | 🔴 | La décision « pas de session → 401 » est déjà dans `requireSession`, testé en unitaire par KOM-06. Ce qui est nouveau ici est le branchement : le middleware monté devant les routes du standup, avant l'ouverture du flux SSE, et le cookie de session qui passe avec CORS credentials | Manuel (smoke) : `POST /standups/conversation`, `GET /standups/today` et `POST /standups` sans cookie → `401` en JSON `ApiError`, pas de flux ouvert ; avec le cookie d'un signin → accès |

## Récap

**Test unitaire automatisé (→ `unit-test-writer`)**

- CA39 : message vide ou blanc refusé en `VALIDATION_ERROR` (schéma Zod de la conversation).
- CA26 : schéma Zod de `StandupSummary` ; le récap du front est transmis tel quel, sans regénération.
- CA29 : parsing du récap, retry unique, puis `SUMMARY_MALFORMED`.

**Couverture partielle 🟠 (unitaire + smoke manuel)**

- CA2, CA4 : unitaire sur la transformation stream → événements `token` et le retrait du marqueur ; smoke `curl -N` sur `POST /standups/conversation`, tokens au fil de l'eau, marqueur jamais visible.
- CA5 : unitaire sur « marqueur → `summary` » ; smoke conversation complète, un seul `summary` bien formé, `[]` pour une catégorie vide.
- CA1, CA8 : unitaire sur le calcul du jour et la décision `done` ; smoke `GET /standups/today` avant et après validation.
- CA35 : unitaire sur le jour civil Paris avec horloge injectée et date du corps ignorée ; smoke `POST /standups` avec un `jour` forcé dans le corps, jour stocké = aujourd'hui à Paris, sans décalage `@db.Date`.
- CA31, CA32 : unitaire sur le mapping des erreurs Groq → événement `error` ; smoke provider injoignable ou timeout → `200 text/event-stream` puis `error` `LLM_UNAVAILABLE`.

**Vérification manuelle (→ `smoke-test-writer`)**

- CA3 : guidage sur les 3 éléments et recadrage des digressions, à l'œil.
- CA6 : le récap validé est réellement écrit en base pour le jour courant.
- CA9 : 2 validations le même jour (en série et en parallèle) → une seule ligne, le second récap.
- (sans numéro) : sans cookie → `401` avant le flux sur les 3 routes du standup ; avec cookie → accès.
