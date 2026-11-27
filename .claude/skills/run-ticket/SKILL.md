---
name: run-ticket
description: Déroule seul tout le workflow d'un ticket backend, de l'inventaire des tests jusqu'à la PR ouverte vers dev, sans intervention humaine. Donne d'avance les accords que les autres skills demanderaient. Utiliser quand l'utilisateur dit "run-ticket", "fais tout le ticket", "déroule le ticket en entier", ou lance un /goal sur un ticket.
---

## Entrée

- Le **lien (ou l'ID) du ticket** Notion.

## Sortie

- L'**URL de la PR** ouverte vers `dev`.
- Un **compte rendu** affiché dans la conversation : l'heure de fin de chaque étape, les décisions prises seul, les tests jugés faux, les smokes en échec, les défauts de review restants.

Le skill ne merge jamais et ne touche pas au ticket Notion.

---

## Contexte

Ce skill est fait pour tourner sans personne, typiquement sous `/goal` : personne ne répondra aux questions. Chaque endroit où un autre skill attendrait un humain est remplacé par un accord donné d'avance (section « Accords donnés d'avance »).

Il n'écrit lui-même ni test ni code : il enchaîne les points d'entrée des 5 étapes de `docs/workflow-ticket-backend.md`.

## Étapes

Lancer `date` au début, puis à la fin de chaque étape.

1. **Démarrer.** Lire le ticket (ID et titre). Créer la branche `<TICKET_ID>-<titre-en-kebab-case>` depuis `dev`.
2. **Planifier les tests.** Lancer l'agent `test-planner` sur le ticket. Commiter `testing/inventaire-<TICKET_ID>.md`.
3. **Écrire les tests.** Lancer `/write-tests`. Commiter les tests et les smokes.
4. **Écrire le code.** Lancer `/write-code` jusqu'à ce que la suite soit verte, puis jouer les smokes (accord 3). Commiter.
5. **Faire la review.** Lancer `/review-code`. S'il y a un défaut ⛔ : le corriger avec `/write-code`, commiter, relancer `/review-code`. 2 allers-retours au maximum. Les défauts restants vont dans le compte rendu.
6. **Ouvrir la PR.** Lancer `/open-pr`.
7. **Afficher le compte rendu** décrit dans la Sortie.

## Accords donnés d'avance

1. **Décision structurante** (nouvelle dépendance, migration Prisma, fichier hors des couches) : l'accord est donné. Écrire le plan dans la conversation, puis l'exécuter, sans passer en mode plan.
2. **Un test qui semble faux** : ne pas le modifier, le noter dans le compte rendu et continuer.
3. **Les smokes** : les jouer soi-même avec curl, sur le serveur local (`pnpm dev`, base du `.env`). Cocher les cases qui passent, noter celles qui échouent.
4. **Les commits** : l'accord est donné de commiter sur la branche du ticket, à la fin de chaque étape, en Conventional Commits. Jamais sur `dev`. Sans ces commits, `/open-pr` s'arrête pour demander.
5. **Toute autre question** : trancher avec l'option la plus proche du ticket, du contrat d'API et des rules, noter la décision et sa raison dans le compte rendu, puis continuer.

## Règles

- Ne jamais lancer `/merge-pr` ni merger quoi que ce soit.
- Ne pas modifier le ticket Notion.
- Les preuves (sorties de `date`, de `pnpm lint`, `pnpm typecheck`, `pnpm test`, URL de la PR) doivent apparaître dans la conversation : sous `/goal`, l'évaluateur ne lance aucun outil et ne juge que ce qu'il lit.
