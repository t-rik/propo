const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  try {
    const [rows] = await db.query('SELECT * FROM functions');
    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: 'Fonctions',
      functions: rows,
      view: '../functions/list',
      css: ['functionList.css'],
      js: ['functionList.js', 'sweet-alert.js']
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve functions' });
  }
});

router.put('/edit/:id', async (req, res) => {
  
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Le nom de la fonction est requis.' });
  }

  try {
    const [result] = await db.query('UPDATE functions SET name = ? WHERE id = ?', [name, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fonction non trouvée.' });
    }

    res.status(200).json({ message: 'Fonction modifiée avec succès.' });
  } catch (error) {
    res.status(500).json({ error: 'Échec de la modification de la fonction.' });
  }
});

router.delete('/delete/:id', async (req, res) => {
  
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM functions WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fonction non trouvée.' });
    }

    res.json({ message: 'Fonction supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ error: 'Échec de la suppression de la fonction.' });
  }
});

router.post('/', async (req, res) => {
  console.log('add');
  
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Le nom de la fonction est requis.' });
  }

  try {
    await db.query('INSERT INTO functions (name) VALUES (?)', [name]);
    res.json({ message: 'Fonction ajoutée avec succès.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la fonction.' });
  }
});

module.exports = router;