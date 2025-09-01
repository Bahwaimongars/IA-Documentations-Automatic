# Prompts pour la Génération de Documentation

## Prompt Principal

```markdown
Tu es un expert en documentation de code. Pour chaque fichier/fonction que je te donne :

## Analyse et génère :
1. **Résumé** : Que fait ce code en 1 phrase
2. **Fonctionnalités** : Liste des features principales  
3. **Paramètres** : Inputs/outputs détaillés
4. **Cas d'usage** : Exemples concrets d'utilisation
5. **Dépendances** : Liens avec autres modules
6. **Notes techniques** : Points d'attention/optimisations

## Format de sortie :
- README.md pour les modules
- Commentaires JSDoc pour les fonctions
- Diagrammes Mermaid pour les flux complexes

## Ton : 
Professionnel mais accessible, avec des exemples pratiques.
```

## Prompts Spécialisés

### Pour les Composants React
```markdown
Documente ce composant React en incluant :
- Props et leur utilisation
- États internes si applicable
- Hooks utilisés
- Exemples d'intégration
- Tests recommandés
```

### Pour les API Routes
```markdown
Documente cette route API en incluant :
- Méthodes HTTP supportées
- Paramètres de requête/corps
- Réponses possibles (succès/erreur)
- Codes de statut
- Exemples d'appels
```

### Pour les Hooks Personnalisés
```markdown
Documente ce hook personnalisé en incluant :
- Valeur de retour
- Paramètres d'entrée
- Cas d'usage typiques
- Règles d'utilisation
- Exemples d'implémentation
```

### Pour les Utilitaires
```markdown
Documente ces fonctions utilitaires en incluant :
- Signature des fonctions
- Paramètres et types
- Valeurs de retour
- Cas d'erreur
- Exemples d'utilisation
```

## Variables de Template

- `{FILE_PATH}` - Chemin du fichier
- `{FILE_NAME}` - Nom du fichier
- `{FILE_TYPE}` - Type de fichier (component, hook, utility, etc.)
- `{CONTENT}` - Contenu du fichier
