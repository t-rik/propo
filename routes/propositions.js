const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../config/uploadConfig');

router.get('/', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect(`/propositions/mes-propositions`);
  }

  try {
    const [propositions] = await db.query(`
      -- Step 1: Find the most recent status from an *ended jury session* for each proposition.
      WITH RankedJuryStatus AS (
        SELECT
          ps.proposition_id,
          ps.average_grade,
          -- Rank by the session's end time to find the latest one.
          ROW_NUMBER() OVER(PARTITION BY ps.proposition_id ORDER BY vs.end_time DESC, vs.id DESC) as rn
        FROM proposition_status ps
        JOIN voting_sessions vs ON ps.voting_session_id = vs.id
        WHERE vs.ended = 1 AND vs.type = 'jury' -- CRITICAL: Only consider ended JURY sessions.
      ),
      -- Step 2: Filter to get only the single latest result for each proposition.
      LatestJuryResult AS (
        SELECT proposition_id, average_grade
        FROM RankedJuryStatus
        WHERE rn = 1
      )
      -- Final Step: Join the results back to the main propositions table.
      SELECT
        p.id, p.display_id, p.objet, p.statut, p.date_emission,
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS utilisateur,
        -- Determine the final display status based on the latest jury vote average grade.
        CASE
          -- If no result is found, it means the proposition was never in an ended jury session.
          WHEN ljr.proposition_id IS NULL THEN 'En attente'
          -- A jury vote average is 0 for No, 6 for Yes. > 3 means more than 50% voted Yes.
          WHEN ljr.average_grade > 3 THEN 'Retenu'
          -- Otherwise, it did not pass the jury vote.
          ELSE 'Non Retenu'
        END AS selection_status
      FROM propositions p
      JOIN users u ON p.user_id = u.id
      -- LEFT JOIN is crucial because not all propositions will have a jury result.
      LEFT JOIN LatestJuryResult ljr ON p.id = ljr.proposition_id
      ORDER BY p.id DESC;
    `);

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: 'Propositions',
      propositions: propositions,
      hasPropositions: propositions.length > 0,
      css: ["tables.css"],
      js: ["ag-grid.js"],
      view: '../admin/propositions/list'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});
router.get('/mes-propositions', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM propositions WHERE user_id = ?', [req.session.userId]);

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: 'Mes Propositions',
      propositions: results,
      hasPropositions: results.length > 0,
      css: ["tables.css"],
      js: ["ag-grid.js", "mespropositions.js"],
      view: '../users/mespropositions'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/add/:userId?', async (req, res) => {
  const { userId } = req.params;
  const targetUserId = req.session.isAdmin && userId ? userId : req.session.userId;

  let targetUsername = null;

  try {
    if (targetUserId !== req.session.userId) {
      const [rows] = await db.query('SELECT username FROM users WHERE id = ?', [targetUserId]);

      if (rows.length > 0) {
        targetUsername = rows[0].username;
      } else {
        return res.status(404).send('Utilisateur non trouve');
      }
    }

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: 'Ajouter Proposition',
      view: '../users/propositionForm',
      css: ['propositionForm.css'],
      js: ['propositionForm.js', 'sweet-alert.js'],
      targetUserId: targetUserId,
      targetUsername: targetUsername,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Erreur');
  }
});

router.post('/add', upload.none(), async (req, res) => {
  const {
    objet,
    description_situation_actuelle,
    description_amelioration_proposee,
    impact_economique,
    impact_technique,
    impact_formation,
    impact_fonctionnement,
    statut,
    target_user_id
  } = req.body;

  const user_id = req.session.isAdmin && target_user_id ? target_user_id : req.session.userId;

  try {
    const [result] = await db.query(
      `INSERT INTO propositions 
        (objet, description_situation_actuelle, description_amelioration_proposee, user_id, impact_economique, impact_technique, impact_formation, impact_fonctionnement, statut) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        objet,
        description_situation_actuelle,
        description_amelioration_proposee,
        user_id,
        impact_economique || 0,
        impact_technique || 0,
        impact_formation || 0,
        impact_fonctionnement || 0,
        statut || 'non soldee'
      ]
    );

    res.json({ success: true, propositionId: result.insertId });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get('/proposition/:id', async (req, res) => {
  const propositionId = req.params.id;

  try {
    const [propositionResult] = await db.query(
      `SELECT * FROM propositions WHERE id = ?`,
      [propositionId]
    );

    if (!propositionResult || propositionResult.length === 0) {
        return res.status(404).send("Proposition not found");
    }
    const proposition = propositionResult[0];

    const [images] = await db.query(
      `SELECT * FROM images WHERE proposition_id = ?`,
      [propositionId]
    );

    const beforeImages = images.filter(img => img.type === 'before');
    const afterImages = images.filter(img => img.type === 'after');

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: proposition.objet,
      proposition: proposition,
      beforeImages,
      afterImages,
      css: ['detailProposition.css'],
      js: ['detailProposition.js', 'sweet-alert.js'],
      view: '../users/detailProposition'
    });
  } catch (error) {
    console.error(`Error fetching proposition: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/proposition/edit/:id', async (req, res) => {
  const propositionId = req.params.id;

  try {
    const [propositionResult] = await db.query(
      `SELECT * FROM propositions WHERE id = ?`,
      [propositionId]
    );

    if (!propositionResult || propositionResult.length === 0) {
      return res.status(404).send('Proposition not found');
    }
    const proposition = propositionResult[0];

    res.render('layouts/main', {
      username: req.session.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin,
      isJury: req.session.isJury,
      title: `Edit Proposition - ${proposition.objet}`,
      proposition: proposition,
      css: ['propositionForm.css'],
      js: ['propositionFormUpdate.js', 'sweet-alert.js'],
      view: '../users/modifierProposition'
    });
  } catch (error) {
    console.error(`Error fetching proposition for edit: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/update/:id', upload.none(), async (req, res) => {
  const propositionId = req.params.id;
  const { objet, description_situation_actuelle, description_amelioration_proposee, impact_economique, impact_fonctionnement, impact_formation, impact_technique, statut } = req.body;

  try {
    await db.query(
      `UPDATE propositions 
       SET objet = ?, description_situation_actuelle = ?, description_amelioration_proposee = ?, impact_economique = ?, impact_fonctionnement = ?, impact_formation = ?, impact_technique = ? ,statut = ?
       WHERE id = ?`,
      [objet, description_situation_actuelle, description_amelioration_proposee,
        impact_economique || 0,
        impact_technique || 0,
        impact_formation || 0,
        impact_fonctionnement || 0,
        statut, propositionId]
    );

    res.json({ success: true, propositionId: propositionId });
  } catch (error) {
    console.error(`Error updating proposition: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

router.delete('/:id/delete', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).send('Forbidden');
  }
  try {
    const [result] = await db.query('DELETE FROM propositions WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Proposition not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;