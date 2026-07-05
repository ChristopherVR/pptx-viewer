---
title: Collaboration
description: Coediter une presentation en temps reel - curseurs en direct, presence et modifications simultanees.
---

# Collaboration

pptx-viewer prend en charge la **coedition en temps reel** : plusieurs personnes peuvent ouvrir la meme presentation a la fois et voir les modifications des autres en direct.

::: info Optionnel et configure par le developpeur
La collaboration est une fonctionnalite optionnelle. Elle ne fonctionne que lorsque l'application est configuree pour se connecter a une session de collaboration (une "salle" sur un serveur de collaboration). Si vous ne voyez pas de controles de collaboration, votre application n'est pas configuree pour cela.
:::

## Ce que ressemble la collaboration

- **Presence en direct** - Une barre d'**avatars** codes par couleur montre qui est dans la session.
- **Curseurs distants** - Vous pouvez voir les curseurs des autres se deplacer sur le canevas de diapositives.
- **Modifications simultanees** - Quand quelqu'un deplace une forme ou edite du texte, vous le voyez se mettre a jour en quasi temps reel.
- **Etat de connexion** - Un indicateur montre si vous etes **connecte**, **en synchronisation** ou **deconnecte**.

## Rejoindre une session

La facon exacte de rejoindre depend de la configuration de votre application :

- L'application **rejoint automatiquement** quand elle se charge.
- L'application fournit une boite de dialogue **Partager** ou vous entrez un **nom de salle** et une **adresse de serveur**.
- Vous ouvrez un **lien** qui contient deja les details de la salle.

::: tip Pas de serveur ? Mode pair-a-pair
Dans les boites de dialogue Partager et Diffuser, vous pouvez laisser l'**adresse du serveur vide** pour demarrer une session **pair-a-pair**.
:::

## Conseils pour une collaboration fluide

- Communiquez sur quelle diapositive chaque personne travaille.
- Surveillez l'**etat de connexion** - si deconnecte, vos modifications recentes peuvent ne pas se synchroniser.
- Les commentaires sont un bon moyen de laisser des retours asynchrones.

## Suite

- [Editer les diapositives](/fr/user/editing)
- [Raccourcis clavier](/fr/user/shortcuts)
