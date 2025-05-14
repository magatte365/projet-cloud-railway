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

// Configuration de Sequelize pour MySQL
// Pour Railway, nous utilisons la variable d'environnement DATABASE_URL si disponible
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tasksdb',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql'
};

// Création de l'instance Sequelize
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'mysql',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  : new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
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

// Synchroniser le modèle avec la base de données et démarrer le serveur
async function startServer() {
  try {
    // Tester la connexion à la base de données
    await sequelize.authenticate();
    console.log('Connexion à MySQL établie avec succès.');
    
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
    console.error('Impossible de se connecter à la base de données:', error);
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