const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Modèle MongoDB
const Task = mongoose.model('Task', {
  title: String,
  description: String,
  completed: Boolean,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

// Connexion à MongoDB
// Pour Railway, nous utilisons la variable d'environnement DATABASE_URL si disponible
const MONGO_URI = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksdb';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Démarrer le serveur
// Railway définit automatiquement la variable PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});