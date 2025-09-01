#!/usr/bin/env node

/**
 * Script de génération automatique de documentation
 * Utilise l'API Claude pour analyser et documenter les fichiers de code
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Chargement des variables d'environnement depuis .env
require('dotenv').config();

// Configuration
const CONFIG = {
  // Utilisation de Claude via Cursor par défaut (pas besoin de clé API)
  useCursorClaude: false,
  
  // Configuration API (fallback si useCursorClaude = false)
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,
  temperature: 0.1
};

// Debug: vérifier que la clé API est chargée
if (CONFIG.apiKey) {
  console.log(`🔑 API Key détectée: ${CONFIG.apiKey.substring(0, 20)}...`);
} else {
  console.log('⚠️  Aucune API Key trouvée dans les variables d\'environnement');
}

// Prompt système pour la génération de documentation
const DOCUMENTATION_PROMPT = `Tu es un expert en documentation de code. Pour chaque fichier/fonction que je te donne :

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

Voici le fichier à documenter :`;

/**
 * Appelle Claude via Cursor pour générer la documentation
 */
async function callCursorClaude(fileContent, filePath) {
  const prompt = `${DOCUMENTATION_PROMPT}

**Fichier:** ${filePath}
**Contenu:**
\`\`\`
${fileContent}
\`\`\`

Génère la documentation complète pour ce fichier.`;

  console.log('🤖 Utilisation de Claude via Cursor...');
  console.log('📋 Copiez le prompt suivant et collez-le dans Claude dans Cursor:');
  console.log('=' .repeat(80));
  console.log(prompt);
  console.log('=' .repeat(80));
  
  // Attendre que l'utilisateur colle la réponse
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n📝 Collez la réponse de Claude ci-dessous, puis appuyez sur Entrée (tapez "END" sur une ligne vide pour terminer):');
    
    let documentation = '';
    
    const collectInput = () => {
      rl.question('', (line) => {
        if (line.trim() === 'END') {
          rl.close();
          resolve(documentation);
        } else {
          documentation += line + '\n';
          collectInput();
        }
      });
    };
    
    collectInput();
  });
}

/**
 * Appelle l'API Claude directement pour générer la documentation
 * (Fallback si Claude via Cursor n'est pas disponible)
 */
async function callClaudeAPI(fileContent, filePath) {
  if (!CONFIG.apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurée. Définissez la variable d\'environnement ou utilisez Claude via Cursor.');
  }

  const prompt = `${DOCUMENTATION_PROMPT}

**Fichier:** ${filePath}
**Contenu:**
\`\`\`
${fileContent}
\`\`\`

Génère la documentation complète pour ce fichier.`;

  try {
    console.log('🌐 Utilisation de l\'API Claude directe...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('❌ Erreur lors de l\'appel API Claude:', error.message);
    throw error;
  }
}

/**
 * Appelle Claude (via Cursor ou API selon la configuration)
 */
async function callClaude(fileContent, filePath) {
  if (CONFIG.useCursorClaude) {
    try {
      return await callCursorClaude(fileContent, filePath);
    } catch (error) {
      console.log('⚠️  Erreur avec Claude via Cursor, basculement vers l\'API...');
      return await callClaudeAPI(fileContent, filePath);
    }
  } else {
    return await callClaudeAPI(fileContent, filePath);
  }
}

/**
 * Détermine le dossier de documentation selon le type de fichier
 */
function getDocumentationFolder(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  
  // Mapping des dossiers selon les patterns de chemin
  const folderMappings = [
    { pattern: /\/components\//, folder: 'components' },
    { pattern: /\/api\//, folder: 'api' },
    { pattern: /\/hooks\//, folder: 'hooks' },
    { pattern: /\/utils\//, folder: 'utils' },
    { pattern: /\/types\//, folder: 'types' },
    { pattern: /\/lib\//, folder: 'lib' },
    { pattern: /\/services\//, folder: 'services' },
    { pattern: /\/middleware\//, folder: 'middleware' },
    { pattern: /\/pages\//, folder: 'pages' },
    { pattern: /\/app\/.*page\.tsx?$/, folder: 'pages' },
    { pattern: /\/app\/.*layout\.tsx?$/, folder: 'layouts' },
    { pattern: /\/app\/.*loading\.tsx?$/, folder: 'loading' },
    { pattern: /\/app\/.*error\.tsx?$/, folder: 'error' },
    { pattern: /\/app\/.*not-found\.tsx?$/, folder: 'error' }
  ];
  
  // Chercher le premier pattern qui correspond
  for (const mapping of folderMappings) {
    if (mapping.pattern.test(normalizedPath)) {
      return mapping.folder;
    }
  }
  
  // Fallback: utiliser le nom du dossier parent ou 'general'
  const pathParts = normalizedPath.split('/');
  if (pathParts.length > 1) {
    const parentFolder = pathParts[pathParts.length - 2];
    if (parentFolder && parentFolder !== 'src' && parentFolder !== 'app') {
      return parentFolder;
    }
  }
  
  return 'general';
}

/**
 * Génère la documentation pour un fichier
 */
async function documentFile(filePath, force = false) {
  try {
    // Lecture du fichier
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier non trouvé: ${filePath}`);
    }
    
    // Déterminer le dossier de documentation approprié
    const docCategory = getDocumentationFolder(filePath);
    const docsDir = path.join(process.cwd(), 'docs', docCategory);
    
    // Création du répertoire docs avec sous-dossiers si nécessaire
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
      console.log(`📁 Dossier créé: docs/${docCategory}/`);
    }
    
    // Génération du nom de fichier de documentation
    const fileName = path.basename(filePath, path.extname(filePath));
    const docPath = path.join(docsDir, `${fileName}.md`);
    
    // Vérifier si la documentation existe déjà
    if (!force && fs.existsSync(docPath)) {
      console.log(`⏭️  Documentation déjà existante (ignoré): ${filePath} -> docs/${docCategory}/${fileName}.md`);
      return { docPath, skipped: true };
    }
    
    console.log(`📝 Génération de documentation pour: ${filePath} -> docs/${docCategory}/`);
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Appel Claude (via Cursor ou API)
    const documentation = await callClaude(fileContent, filePath);
    
    // Sauvegarde de la documentation
    fs.writeFileSync(docPath, documentation, 'utf8');
    
    console.log(`✅ Documentation générée: docs/${docCategory}/${fileName}.md`);
    return { docPath, skipped: false };
    
  } catch (error) {
    console.error(`❌ Erreur lors de la documentation de ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Génère un index de la documentation organisée
 */
function generateDocumentationIndex() {
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) return;

  let indexContent = `# 📚 Index de la Documentation\n\n`;
  indexContent += `*Documentation générée automatiquement le ${new Date().toLocaleDateString('fr-FR')}*\n\n`;

  // Parcourir les dossiers de documentation
  const categories = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort();

  for (const category of categories) {
    const categoryPath = path.join(docsDir, category);
    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.md'))
      .sort();

    if (files.length > 0) {
      // Emoji par catégorie
      const categoryEmojis = {
        'components': '🧩',
        'api': '🔌',
        'hooks': '🎣',
        'utils': '🛠️',
        'types': '📝',
        'pages': '📄',
        'layouts': '🏗️',
        'services': '⚙️',
        'lib': '📚',
        'middleware': '🔀',
        'general': '📋'
      };

      const emoji = categoryEmojis[category] || '📁';
      indexContent += `## ${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      files.forEach(file => {
        const fileName = path.basename(file, '.md');
        const relativePath = `${category}/${file}`;
        indexContent += `- [${fileName}](${relativePath})\n`;
      });
      
      indexContent += '\n';
    }
  }

  // Ajouter des statistiques
  const totalFiles = categories.reduce((sum, category) => {
    const categoryPath = path.join(docsDir, category);
    const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.md'));
    return sum + files.length;
  }, 0);

  indexContent += `---\n\n`;
  indexContent += `📊 **Statistiques**\n`;
  indexContent += `- **${totalFiles}** fichiers documentés\n`;
  indexContent += `- **${categories.length}** catégories\n`;
  indexContent += `- Dernière mise à jour: ${new Date().toLocaleString('fr-FR')}\n\n`;
  
  indexContent += `🔧 **Généré avec**\n`;
  indexContent += `- Script: \`scripts/doc-generator.js\`\n`;
  indexContent += `- IA: Claude 3.5 Sonnet\n`;

  // Sauvegarder l'index
  const indexPath = path.join(docsDir, 'README.md');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log(`📑 Index généré: docs/README.md`);
}

/**
 * Génère la documentation pour plusieurs fichiers
 */
async function documentMultipleFiles(filePaths, force = false) {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const result = await documentFile(filePath, force);
      if (result.skipped) {
        results.push({ filePath, docPath: result.docPath, success: true, skipped: true });
      } else {
        results.push({ filePath, docPath: result.docPath, success: true, skipped: false });
      }
    } catch (error) {
      results.push({ filePath, error: error.message, success: false, skipped: false });
    }
  }
  
  return results;
}

/**
 * Trouve automatiquement les fichiers à documenter
 */
function findFilesToDocument(directory = './src', extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile() && extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }
  
  if (fs.existsSync(directory)) {
    scanDirectory(directory);
  }
  
  return files;
}

/**
 * Interface en ligne de commande
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 Générateur de Documentation Automatique

Usage:
  node scripts/doc-generator.js <fichier>              # Documenter un fichier
  node scripts/doc-generator.js --all                  # Documenter tous les fichiers
  node scripts/doc-generator.js --dir <répertoire>     # Documenter un répertoire
  node scripts/doc-generator.js --force <fichier>      # Forcer la régénération
  node scripts/doc-generator.js --all --force          # Forcer tous les fichiers
  node scripts/doc-generator.js --api <fichier>        # Utiliser l'API directe

Modes d'utilisation:
  🤖 Claude via Cursor (par défaut) - Pas de clé API requise
  🌐 API Claude directe (--api) - Nécessite ANTHROPIC_API_KEY

Variables d'environnement (optionnelles):
  ANTHROPIC_API_KEY=your_api_key    # Pour l'API directe uniquement

Exemples:
  node scripts/doc-generator.js src/components/TodoCard.tsx        # Via Cursor
  node scripts/doc-generator.js --api src/components/TodoCard.tsx  # Via API
  node scripts/doc-generator.js --all
  node scripts/doc-generator.js --dir src/components
  node scripts/doc-generator.js --force src/components/TodoCard.tsx
    `);
    return;
  }
  
  try {
    let results;
    const forceMode = args.includes('--force');
    const apiMode = args.includes('--api');
    const filteredArgs = args.filter(arg => !['--force', '--api'].includes(arg));
    
    // Configuration du mode d'appel Claude
    if (apiMode) {
      CONFIG.useCursorClaude = false;
      console.log('🌐 Mode API directe activé');
    } else {
      console.log('🤖 Mode Claude via Cursor activé (par défaut)');
    }
    
    if (filteredArgs[0] === '--all') {
      // Documenter tous les fichiers du projet
      const files = findFilesToDocument();
      console.log(`📁 ${files.length} fichiers trouvés à documenter`);
      if (forceMode) {
        console.log(`🔄 Mode force activé - régénération de tous les fichiers`);
      }
      results = await documentMultipleFiles(files, forceMode);
      
    } else if (filteredArgs[0] === '--dir' && filteredArgs[1]) {
      // Documenter un répertoire spécifique
      const files = findFilesToDocument(filteredArgs[1]);
      console.log(`📁 ${files.length} fichiers trouvés dans ${filteredArgs[1]}`);
      if (forceMode) {
        console.log(`🔄 Mode force activé - régénération forcée`);
      }
      results = await documentMultipleFiles(files, forceMode);
      
    } else {
      // Documenter un fichier spécifique
      const filePath = filteredArgs[0];
      const result = await documentFile(filePath, forceMode);
      if (result.skipped) {
        results = [{ filePath, docPath: result.docPath, success: true, skipped: true }];
      } else {
        results = [{ filePath, docPath: result.docPath, success: true, skipped: false }];
      }
    }
    
    // Rapport final avec organisation par dossiers
    console.log('\n📊 Rapport de génération:');
    const successful = results.filter(r => r.success && !r.skipped);
    const skipped = results.filter(r => r.success && r.skipped);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Générés: ${successful.length}`);
    if (skipped.length > 0) {
      console.log(`⏭️  Ignorés (déjà existants): ${skipped.length}`);
    }
    if (failed.length > 0) {
      console.log(`❌ Échecs: ${failed.length}`);
      failed.forEach(f => console.log(`   - ${f.filePath}: ${f.error}`));
    }
    
    // Affichage de l'organisation par dossiers
    if (successful.length > 0) {
      const byCategory = successful.reduce((acc, result) => {
        const category = getDocumentationFolder(result.filePath);
        if (!acc[category]) acc[category] = [];
        acc[category].push(path.basename(result.filePath));
        return acc;
      }, {});
      
      console.log('\n📁 Documentation organisée par catégories:');
      Object.entries(byCategory).forEach(([category, files]) => {
        console.log(`   📂 docs/${category}/ (${files.length} fichier${files.length > 1 ? 's' : ''})`);
        files.forEach(file => console.log(`      - ${file}`));
      });
    }
    
    if (skipped.length > 0 && !forceMode) {
      console.log(`\n💡 Astuce: Utilisez --force pour régénérer les fichiers existants`);
    }

    // Générer l'index de documentation si des fichiers ont été créés
    if (successful.length > 0 || (successful.length === 0 && skipped.length > 0)) {
      console.log('\n📑 Génération de l\'index de documentation...');
      generateDocumentationIndex();
    }
    
  } catch (error) {
    console.error('💥 Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Point d'entrée
if (require.main === module) {
  main();
}

module.exports = {
  documentFile,
  documentMultipleFiles,
  findFilesToDocument,
  callClaude,
  callCursorClaude,
  callClaudeAPI
};