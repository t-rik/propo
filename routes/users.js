const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');
const session = require('express-session');

router.get('/add', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  try {
    const [functions] = await db.query('SELECT * FROM functions');
    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,

      title: 'ajouter utilisateur',
      css: ['addUser.css'],
      js: [],
      view: '../admin/users/addUser',
      functions: functions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while rendering the add user page.' });
  }
});

router.post('/add', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const { username, password, first_name, last_name, function_id, is_admin, is_jury } = req.body;
  try {
    const [results] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (results.length > 0) {
      req.flash('error_msg', 'Username already exists');
      return res.redirect('/users/add');
    }

    await db.query(
      'INSERT INTO users (username, password, first_name, last_name, function_id, is_admin, is_jury) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, password, first_name, last_name, function_id, is_admin ? 1 : 0, is_jury ? 1 : 0]
    );

    req.flash('success_msg', 'User added');
    return res.redirect('/users/add');
  } catch (err) {
    console.log(err);
    req.flash('error_msg', 'An error occurred');
    return res.redirect('/users/add');
  }
});

router.get('/', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, f.name AS function_name, u.is_admin, u.is_jury
      FROM users u
      LEFT JOIN functions f ON u.function_id = f.id
    `);

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: 'Liste des Utilisateurs',
      css: ['listUsers.css'],
      js: [],
      view: '../admin/users/listUsers',
      users: users
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred while fetching the user list' });
  }
});

router.get('/edit/:id', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const [results] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [functions] = await db.query('SELECT * FROM functions');

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,

      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,

      title: 'Modifier utilisateur',
      view: '../admin/users/editUser',
      css: ['editUser.css', "dropzone.css"],
      js: ["dropzone.js", "editUser.js", "compressor.js"],
      user: results[0],
      functions: functions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

router.post('/edit/:id', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const userId = parseInt(req.params.id, 10);
  const { username, password, first_name, last_name, function_id, is_admin, is_jury } = req.body;

  if (isNaN(userId)) {
    req.flash('error', 'ID d\'utilisateur invalide');
    return res.redirect(`/users/edit/${userId}`);
  }

  try {
    const [existingUser] = await db.query('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (existingUser.length > 0) {
      req.flash('error_msg', 'Le nom d\'utilisateur existe déjà');
      return res.redirect(`/users/edit/${userId}`);
    }

    let updateFields = [
      'username = ?',
      'first_name = ?',
      'last_name = ?',
      'function_id = ?',
      'is_admin = ?',
      'is_jury = ?'
    ];
    let updateValues = [username, first_name, last_name, function_id, is_admin ? 1 : 0, is_jury ? 1 : 0];

    if (password) {
      updateFields.push('password = ?');
      updateValues.push(password); // Store plain text password directly
    }

    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(userId);

    await db.query(sql, updateValues);

    res.redirect(`/users/`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Une erreur est survenue');
    res.redirect(`/users/edit/${userId}`);
  }
});

router.post('/delete/:id', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }
  const userId = req.params.id;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    req.flash('success', 'User deleted');
    return res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'An error occurred');
    return res.redirect('/users');
  }
});

module.exports = router;
