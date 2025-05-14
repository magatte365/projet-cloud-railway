# Gestionnaire de Tâches - Projet Cloud Railway


## 📝 Description

Ce projet est une application de gestion de tâches full-stack déployée sur Railway en utilisant GitHub Actions pour le CI/CD. L'application permet de:

- Créer des tâches avec titre et description
- Marquer les tâches comme complétées ou en attente
- Supprimer des tâches existantes
- Visualiser toutes les tâches dans une interface intuitive

## 🛠️ Technologies utilisées

### Backend
- **Node.js** (v18+)
- **Express** - Framework web
- **Sequelize** - ORM pour la base de données

### Base de données
- **MySQL** - Hébergée sur Railway

### Frontend
- **Bootstrap 5** - Framework CSS
- **Bootstrap Icons** - Bibliothèque d'icônes

### Infrastructure
- **Railway** - Platform as a Service (PAAS)
- **GitHub Actions** - CI/CD pipeline

## 🚀 Déploiement

L'application est déployée automatiquement sur Railway à chaque push sur la branche `main` grâce à GitHub Actions.

### Configuration requise
1. Compte Railway avec un projet créé
2. Base de données MySQL configurée sur Railway
3. Token Railway stocké dans les secrets GitHub (`RAILWAY_TOKEN`)

### Workflow GitHub Actions
Le workflow se déclenche à chaque push sur `main` et exécute les étapes suivantes:
1. Checkout du code
2. Installation de Node.js 18
3. Installation des dépendances
4. Déploiement sur Railway via la CLI


## 🔧 Configuration

1. Clonez le dépôt:
   ```bash
   git clone https://github.com/magatte365/projet-cloud-railway.git
   ```

2. Installez les dépendances:
   ```bash
   npm install
   ```

3. Configurez les variables d'environnement:
   - Créez un fichier `.env` à la racine
   - Ajoutez les variables nécessaires (DB_HOST, DB_USER, DB_PASSWORD, etc.)

4. Pour lancer en développement:
   ```bash
   npm run dev
   ```
