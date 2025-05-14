const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration pour la gestion des CORS pour Railway
app.use((req, res, next) => {
  // Autorise les requêtes depuis n'importe quelle origine en production
  // Utile si vous avez un frontend séparé plus tard
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    return res.status(200).json({});
  }
  next();
});

// Déterminer si nous utilisons des connexions privées Railway ou locales
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

// Configuration de Sequelize pour MySQL
// Privilégier les connexions privées sur Railway
let sequelize;

if (isRailway) {
  // Variables Railway pour les connexions privées
  const dbName = process.env.MYSQL_DATABASE;
  const dbUser = process.env.MYSQL_USER;
  const dbPassword = process.env.MYSQL_PASSWORD;
  const dbHost = process.env.MYSQL_HOST || process.env.MYSQLHOST;  // Railway peut utiliser l'un ou l'autre
  const dbPort = process.env.MYSQL_PORT || process.env.MYSQLPORT || 3306;

  console.log("Tentative de connexion à MySQL avec les paramètres Railway (connexion privée)");
  console.log(`Host: ${dbHost}, Database: ${dbName}, User: ${dbUser}, Port: ${dbPort}`);

  sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    dialectOptions: {
      // Sans SSL pour les connexions privées entre services Railway
    },
    logging: false
  });
} else {
  // Configuration locale (développement)
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tasksdb',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql'
  };

  console.log("Utilisation de la configuration de base de données locale");
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false
  });
}

// Définition du modèle Task avec Sequelize
const Task = sequelize.define('Task', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le titre est requis'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'tasks',
  timestamps: true
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour vérifier l'état de l'API (healthcheck)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour créer une tâche (WRITE)
app.post('/api/tasks', async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ 
      error: error.message,
      details: error.errors ? error.errors.map(e => e.message) : null 
    });
  }
});

// Endpoint pour récupérer toutes les tâches (READ)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour mettre à jour une tâche (UPDATE)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const [updated] = await Task.update(req.body, {
      where: { id: req.params.id },
      returning: true
    });
    
    if (updated === 0) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }
    
    const task = await Task.findByPk(req.params.id);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint pour supprimer une tâche (DELETE)
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const deleted = await Task.destroy({
      where: { id: req.params.id }
    });
    
    if (deleted === 0) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }
    
    res.json({ message: "Tâche supprimée avec succès" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Gestion d'erreur pour les routes non trouvées
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Middleware d'erreur global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur serveur interne" });
});

// Fonction pour tenter une connexion avec retries
async function connectWithRetry(maxRetries = 5, delay = 5000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Tester la connexion à la base de données
      await sequelize.authenticate();
      console.log('Connexion à MySQL établie avec succès.');
      return true;
    } catch (error) {
      retries++;
      console.log(`Tentative de connexion échouée (${retries}/${maxRetries}): ${error.message}`);
      if (retries < maxRetries) {
        console.log(`Nouvelle tentative dans ${delay/1000} secondes...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Impossible de se connecter à la base de données après plusieurs tentatives:', error);
        return false;
      }
    }
  }
}

// Synchroniser le modèle avec la base de données et démarrer le serveur
async function startServer() {
  try {
    // Tenter de se connecter à la base de données avec des retries
    const connected = await connectWithRetry();
    
    if (!connected) {
      console.error("Échec de connexion à la base de données après plusieurs tentatives. Démarrage du serveur sans base de données.");
      // Démarrer le serveur même sans base de données pour permettre le healthcheck
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Serveur démarré sur le port ${PORT} (SANS connexion DB)`);
        console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
      });
      return;
    }
    
    // Synchroniser les modèles avec la base de données
    // force: false - ne pas supprimer les tables existantes
    await sequelize.sync({ force: false });
    console.log('Modèles synchronisés avec la base de données.');
    
    // Démarrer le serveur
    // Railway définit automatiquement la variable PORT
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
      console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur:', error);
  }
}

// Gestion propre de la fermeture pour Railway
process.on('SIGINT', async () => {
  await sequelize.close();
  console.log('Connexion à la base de données fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await sequelize.close();
  console.log('Connexion à la base de données fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

// Démarrer le serveur
startServer();