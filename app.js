const express = require('express');
const mongoose = require('mongoose');
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

// Modèle MongoDB
const Task = mongoose.model('Task', {
  title: {
    type: String,
    required: [true, 'Le titre est requis']
  },
  description: String,
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour la gestion des erreurs MongoDB
const handleMongoError = (err, req, res, next) => {
  if (err instanceof mongoose.Error) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

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
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint pour récupérer toutes les tâches (READ)
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour mettre à jour une tâche (UPDATE)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ error: "Tâche non trouvée" });
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint pour supprimer une tâche (DELETE)
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Tâche non trouvée" });
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

// Connexion à MongoDB avec options optimisées pour Railway
// Pour Railway, nous utilisons la variable d'environnement DATABASE_URL si disponible
const MONGO_URI = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksdb';

mongoose.connect(MONGO_URI, {
  // Ces options sont recommandées pour assurer une connexion stable
  // même si Railway redémarre votre application ou modifie son environnement
  retryWrites: true,
  w: 'majority',
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => {
    console.error('Erreur de connexion à MongoDB:', err);
    // Ne pas faire crasher l'app complètement, Railway pourrait la redémarrer
    // et cela permettrait des nouvelles tentatives de connexion
  });

// Gestion propre de la fermeture pour Railway
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Connexion MongoDB fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  console.log('Connexion MongoDB fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

// Démarrer le serveur
// Railway définit automatiquement la variable PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});