---
title: Apercu de la documentation
description: Une carte de la documentation pptx-viewer - quelle section lire selon que vous integrez une visionneuse, manipulez des fichiers .pptx par code, utilisez l'editeur ou automatisez avec des agents.
---

# Apercu de la documentation

La documentation est organisee par objectif. Utilisez cette page pour trouver la bonne section, puis suivez l'ordre de lecture propose.

## Choisissez un parcours

| Vous voulez...                                              | Commencez par                                                                                                                                                                                                              | Ensuite                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Integrer une visionneuse ou un editeur PowerPoint           | La page de demarrage de votre framework : [React](/react/getting-started), [Vue 3](/vue/getting-started), [Angular](/angular/getting-started), [Svelte 5](/svelte/getting-started), [Vanilla JS](/vanilla/getting-started) | La reference props/API de la meme section, puis [Theming](/fr/guide/theming) et [Localisation](/fr/guide/localization) |
| Lire, modifier ou generer des fichiers `.pptx` par code     | [Core : chargement](/core/loading) et [l'API Builder](/core/builder)                                                                                                                                                       | [Edition](/core/editing), [Enregistrement](/core/saving), [le modele de donnees](/fr/guide/data-model)                 |
| Convertir des presentations en Markdown, images, PDF ou SVG | [Convertisseur Markdown](/core/converter) et [Export SVG](/core/svg-export)                                                                                                                                                | La page Export de votre binding pour les formats navigateur                                                            |
| Utiliser l'editeur (sans ecrire de code)                    | [Guide utilisateur](/user/)                                                                                                                                                                                                | [Edition des diapositives](/user/editing), [Raccourcis clavier](/user/shortcuts)                                       |
| Laisser des agents IA travailler sur des presentations      | [MCP et outils](/packages/mcp)                                                                                                                                                                                             | [CLI du core](/core/cli)                                                                                               |
| Comprendre le fonctionnement interne                        | [Architecture](/fr/guide/architecture)                                                                                                                                                                                     | [Conformite OOXML](/architecture/openxml-conformance), [Limitations](/fr/guide/limitations)                            |

## Nouveau sur le projet

Si aucun parcours ne correspond encore, lisez ces trois pages dans l'ordre :

1. [Qu'est-ce que pptx-viewer ?](/fr/guide/introduction) : la famille de packages et le role de chacun.
2. [Installation](/fr/guide/installation) : quel package installer pour votre stack.
3. [Demarrage rapide](/fr/guide/quick-start) : quatre flux complets avec l'API publique.

::: info Langue
Les pages conceptuelles du guide sont traduites en francais ; les references detaillees des packages (Core, React, Vue, Angular, Svelte, Vanilla) sont en anglais.
:::
