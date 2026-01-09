# Guide de Contribution

Merci de votre intérêt pour contribuer à **ADT - Extracteur de Données Tabulaires** ! 🎉

## Table des Matières

- [Code de Conduite](#code-de-conduite)
- [Comment Contribuer](#comment-contribuer)
- [Standards de Code](#standards-de-code)
- [Processus de Pull Request](#processus-de-pull-request)
- [Signaler des Bugs](#signaler-des-bugs)
- [Proposer des Fonctionnalités](#proposer-des-fonctionnalités)

## Code de Conduite

Ce projet adhère à un code de conduite. En participant, vous vous engagez à respecter ce code.

### Nos Engagements

- Utiliser un langage accueillant et inclusif
- Respecter les points de vue et expériences différents
- Accepter gracieusement les critiques constructives
- Se concentrer sur ce qui est le mieux pour la communauté

## Comment Contribuer

### 1. Fork et Clone

```bash
# Fork le projet sur GitHub, puis :
git clone https://github.com/VOTRE-USERNAME/Extracteur-de-donnee-TCT.git
cd Extracteur-de-donnee-TCT
```

### 2. Créer une Branche

```bash
# Créez une branche pour votre fonctionnalité ou correction
git checkout -b feature/ma-nouvelle-fonctionnalite
# ou
git checkout -b fix/correction-bug
```

### 3. Développer

- Écrivez du code propre et bien documenté
- Suivez les standards de code (voir ci-dessous)
- Testez vos modifications localement
- Committez régulièrement avec des messages clairs

### 4. Tester

```bash
# Démarrez le backend
npx tsx local-server.ts

# Démarrez le frontend (nouveau terminal)
npm run dev

# Vérifiez que tout fonctionne
```

### 5. Committer

```bash
git add .
git commit -m "feat: ajoute nouvelle fonctionnalité X"
# ou
git commit -m "fix: corrige le bug Y"
```

### 6. Pusher

```bash
git push origin feature/ma-nouvelle-fonctionnalite
```

### 7. Pull Request

- Allez sur GitHub et créez une Pull Request
- Décrivez vos changements en détail
- Liez les issues pertinentes

## Standards de Code

### TypeScript

- **Typage strict** : Évitez `any`, utilisez des types explicites
- **Interfaces** : Préférez les interfaces aux types pour les objets
- **Naming** : camelCase pour variables/fonctions, PascalCase pour composants/types

```typescript
// ✅ Bon
interface UserData {
  numDome: string;
  idEmploye: string;
}

const fetchUserData = async (id: string): Promise<UserData> => {
  // ...
};

// ❌ Mauvais
const fetchUserData = async (id: any) => {
  // ...
};
```

### React

- **Composants Fonctionnels** : Utilisez des fonctions, pas des classes
- **Hooks** : Utilisez les hooks React modernes
- **Props** : Typez toujours les props avec TypeScript

```typescript
// ✅ Bon
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false }) => {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
};

// ❌ Mauvais
export const Button = (props) => {
  return <button onClick={props.onClick}>{props.label}</button>;
};
```

### Styling

- **Tailwind CSS** : Utilisez les classes Tailwind via `index.css`
- **Classes personnalisées** : Définissez dans `index.css`
- **Responsive** : Pensez mobile-first

### Commits

Suivez la convention [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajoute support pour nouveau modèle IA
fix: corrige l'erreur de parsing PDF
docs: met à jour le README
style: formate le code avec Prettier
refactor: restructure le service d'extraction
test: ajoute tests pour FileUploader
chore: met à jour les dépendances
```

## Processus de Pull Request

### Checklist

Avant de soumettre votre PR, vérifiez que :

- [ ] Le code compile sans erreurs (`npm run build`)
- [ ] Les types TypeScript sont corrects
- [ ] Le code est formaté correctement
- [ ] Les nouvelles fonctionnalités sont documentées
- [ ] Les tests passent (si applicable)
- [ ] La PR a une description claire
- [ ] Les commits suivent la convention

### Revue de Code

- Soyez patient, les revues peuvent prendre du temps
- Répondez aux commentaires de manière constructive
- Effectuez les modifications demandées
- Demandez des clarifications si nécessaire

### Merge

Une fois approuvée, votre PR sera mergée par un mainteneur.

## Signaler des Bugs

### Avant de Signaler

1. Vérifiez que le bug n'a pas déjà été signalé
2. Assurez-vous que c'est bien un bug et non une fonctionnalité
3. Collectez des informations sur le bug

### Template de Bug Report

```markdown
**Description**
Description claire et concise du bug.

**Reproduction**
Étapes pour reproduire :
1. Aller à '...'
2. Cliquer sur '...'
3. Voir l'erreur

**Comportement Attendu**
Ce qui devrait se passer.

**Comportement Actuel**
Ce qui se passe réellement.

**Screenshots**
Si applicable, ajoutez des captures d'écran.

**Environnement**
- OS: [ex. Windows 11]
- Navigateur: [ex. Chrome 120]
- Version Node: [ex. 18.17.0]

**Informations Supplémentaires**
Tout autre contexte pertinent.
```

## Proposer des Fonctionnalités

### Avant de Proposer

1. Vérifiez que la fonctionnalité n'existe pas déjà
2. Assurez-vous qu'elle correspond à la vision du projet
3. Réfléchissez à l'implémentation

### Template de Feature Request

```markdown
**Problème à Résoudre**
Quel problème cette fonctionnalité résout-elle ?

**Solution Proposée**
Description claire de la solution.

**Alternatives Considérées**
Autres solutions envisagées.

**Informations Supplémentaires**
Mockups, exemples, etc.
```

## Domaines de Contribution

### Priorités Actuelles

- 🐛 **Corrections de bugs** : Toujours bienvenues
- 📚 **Documentation** : Amélioration de la doc
- 🎨 **UI/UX** : Améliorations de l'interface
- ⚡ **Performance** : Optimisations
- 🧪 **Tests** : Ajout de tests unitaires/e2e

### Idées de Contribution

- Ajouter support pour d'autres formats (Excel, Word)
- Améliorer la précision de l'extraction
- Ajouter des graphiques et visualisations
- Internationalisation (i18n)
- Mode clair/sombre toggle
- Export vers Google Sheets
- API REST publique

## Questions ?

Si vous avez des questions, n'hésitez pas à :
- Ouvrir une issue sur GitHub
- Contacter [@zakibelm](https://github.com/zakibelm)

---

**Merci de contribuer à ADT ! 🙏**
