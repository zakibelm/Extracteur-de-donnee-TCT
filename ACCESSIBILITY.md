# Accessibilité - ADT Extracteur

## Vue d'ensemble

L'application ADT Extracteur suit les directives WCAG 2.1 (Web Content Accessibility Guidelines) niveau AA pour garantir une expérience accessible à tous les utilisateurs.

## Standards Implémentés

### ✅ Navigation au Clavier

Tous les éléments interactifs sont accessibles au clavier :

- **Boutons** : Navigation avec Tab, activation avec Enter/Space
- **Cards cliquables** : `role="button"`, `tabIndex={0}`, support Enter/Space
- **Formulaires** : Navigation séquentielle, labels associés
- **Modales** : Fermeture avec Escape, focus trap

### ✅ Sémantique HTML

Structure correcte pour les technologies d'assistance :

- Utilisation correcte des balises landmark (`<main>`, `<nav>`, `<aside>`, `<header>`)
- Hiérarchie des titres (`h1` -> `h2` -> `h3`) respectée
- Labels explicites pour tous les champs de formulaire

### ✅ Contraste et Couleurs

- Respect du ratio de contraste 4.5:1 pour le texte normal
- Indicateurs visuels de focus pour tous les éléments interactifs
- L'information n'est jamais transmise uniquement par la couleur

## Checklist pour les Développeurs

Lors de l'ajout de nouvelles fonctionnalités, assurez-vous de :

1.  [ ] Utiliser des éléments sémantiques (`<button>`, `<a>`) quand c'est possible.
2.  [ ] Si une `div` est cliquable, ajouter :
    -   `role="button"`
    -   `tabIndex={0}`
    -   `onKeyDown` (gérer Enter et Space)
3.  [ ] Vérifier que le focus est visible (`outline` ou style personnalisé).
4.  [ ] Ajouter `aria-label` si le bouton ne contient qu'une icône.
5.  [ ] Tester la navigation complète avec la touche Tab.

## Tests

Pour vérifier la conformité, utilisez :
- **Navigation Clavier** : Tab, Enter, Space, Echap, Flèches.
- **Lecteurs d'écran** : NVDA (Windows) ou VoiceOver (Mac).
- **Outils** : Lighthouse (Chrome DevTools), axe DevTools.
