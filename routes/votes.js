const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../config/uploadConfig');
const { render } = require('ejs');


router.post('/init', async (req, res) => {
    const { type } = req.body;

    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Non autorisé' });
    }

    if (!['jury', 'global'].includes(type)) {
        return res.status(400).json({ error: 'Type de session de vote invalide' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [activeSession] = await connection.query('SELECT * FROM voting_sessions WHERE is_active = 1');

        if (activeSession.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Il y a déjà une session de vote en cours' });
        }

        let propositionsQuery = `
            SELECT p.*
            FROM propositions p
            LEFT JOIN proposition_status ps ON p.id = ps.proposition_id
            WHERE 1=1
        `;

        if (type === 'global') {
            propositionsQuery += `
                AND p.retenu = 1
                AND p.statut = 'soldee'
                AND p.id NOT IN (
                    SELECT ps.proposition_id
                    FROM proposition_status ps
                    JOIN voting_sessions vs ON ps.voting_session_id = vs.id
                    WHERE vs.type = 'global'
                )
            `;
        }

        if (type === 'jury') {
            propositionsQuery += `
                AND p.id NOT IN (
                    SELECT ps.proposition_id
                    FROM proposition_status ps
                )
                AND p.statut != 'annulee'
            `;
        }

        const [propositions] = await connection.query(propositionsQuery);

        if (propositions.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Aucune proposition disponible pour le vote' });
        }

        await connection.query('UPDATE propositions SET locked = 1 WHERE id IN (?)', [
            propositions.map(p => p.id),
        ]);

        const [result] = await connection.query(
            'INSERT INTO voting_sessions (type, init_time, is_active) VALUES (?, NOW(), 1)',
            [type]
        );

        const statusInsertPromises = propositions.map(p => {
            return connection.query('INSERT INTO proposition_status (proposition_id, voting_session_id) VALUES (?, ?)', [p.id, result.insertId]);
        });

        await Promise.all(statusInsertPromises);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Session de vote initialisée',
            sessionId: result.insertId,
            propositions,
        });
    } catch (error) {
        await connection.rollback();
        console.log(error);
        res.status(500).json({ error: 'Erreur de base de données', details: error });
    } finally {
        connection.release();
    }
});

router.post('/:sessionId/start', async (req, res) => {
    const { sessionId } = req.params;

    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const [sessionResult] = await db.query('UPDATE voting_sessions SET started = 1 WHERE id = ?', [sessionId]);

        if (sessionResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Voting session not found' });
        }

        res.status(200).json({ success: true, message: 'Voting session started, jury can vote now' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error });
    }
});

router.post('/:sessionId/end', async (req, res) => {
    const { sessionId } = req.params;

    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [sessionResult] = await connection.query('UPDATE voting_sessions SET is_active = 0, ended = 1, end_time = NOW() WHERE id = ?', [sessionId]);
        if (sessionResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Voting session not found' });
        }
        
        const [[session]] = await connection.query('SELECT type FROM voting_sessions WHERE id = ?', [sessionId]);
        
        let validatedPropositions = [];

        if (session.type === 'jury') {
            // CORRECTED LOGIC: Retained if more than 50% of jurors voted "Oui"
            const [propositions] = await connection.query(
                `SELECT p.id, p.display_id, p.objet
                 FROM propositions p
                 JOIN votes v ON p.id = v.proposition_id
                 WHERE v.session_id = ?
                 GROUP BY p.id, p.display_id, p.objet
                 HAVING (SUM(CASE WHEN v.vote_value = 6 THEN 1 ELSE 0 END) / COUNT(v.user_id)) > 0.5`,
                [sessionId]
            );
            
            if (propositions.length > 0) {
                const propositionIds = propositions.map(p => p.id);
                await connection.query('UPDATE propositions SET retenu = 1 WHERE id IN (?)', [propositionIds]);
            }
            validatedPropositions = propositions;
        }

        await connection.commit();
        res.json({
            message: 'Voting session closed',
            validatedPropositions,
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error ending session:", error);
        res.status(500).json({ error: 'Database error', details: error });
    } finally {
        connection.release();
    }
});

router.get('/', async (req, res) => {
    if (!req.session.isAdmin  && !req.session.isJury) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const sessions = await db.query('SELECT * FROM voting_sessions');

    res.render('layouts/main', {
        username: req.session.username, userId: req.session.userId,
        isAdmin: req.session.isAdmin,
        isJury: req.session.isJury,
        sessions: sessions[0],
        title: 'SESSIONS',
        view: '../voting-sessions/list',
        css: ['tables.css'],
        js: ['ag-grid.js', 'sweet-alert.js']
    });
});

router.delete('/:sessionId', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const [session] = await db.query('SELECT * FROM voting_sessions WHERE id = ?', [req.params.sessionId]);
        if (session.length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const [lastSession] = await db.query('SELECT * FROM voting_sessions ORDER BY id DESC LIMIT 1');
        if (lastSession.length === 0 || lastSession[0].id !== session[0].id) {
            return res.status(400).json({ error: 'error', message: 'Only the last created voting session can be deleted' });
        }

        await db.query('DELETE FROM voting_sessions WHERE id = ?', [req.params.sessionId]);

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error });
    }
});

router.get('/current-proposition-id', async (req, res) => {
    try {
        const [proposition] = await db.query(`
            SELECT ps.proposition_id
            FROM proposition_status ps
            JOIN voting_sessions vs ON ps.voting_session_id = vs.id
            WHERE vs.is_active = 1 AND vs.started = 1 AND vs.ended = 0
            AND ps.voting_completed = 0
            ORDER BY ps.proposition_id ASC
            LIMIT 1
        `);

        if (proposition.length === 0) {
            return res.status(404).json({ message: 'Aucune proposition disponible pour le vote.' });
        }

        res.status(200).json({ propositionId: proposition[0].proposition_id });
    } catch (error) {
        console.error(`Erreur lors de la récupération de l'ID de la proposition : ${error.message}`);
        res.status(500).json({ error: 'Erreur interne du serveur : ' + error.message });
    }
});


// in routes/votes.js

router.get('/jury-vote', async (req, res) => {
    const userId = req.session.userId;
    if (!req.session.isJury) {
        req.flash('error_msg', 'Vous devez être un membre du jury pour accéder à cette page.');
        return res.redirect('/propositions/mes-propositions');
    }

    try {
        const [activeSession] = await db.query(`
            SELECT id FROM voting_sessions 
            WHERE is_active = 1 AND started = 1 AND ended = 0 AND type = 'jury'
        `);

        if (activeSession.length === 0) {
            // Render a specific view for when no session is active
            return res.render('layouts/main', {
                username: req.session.username,
                userId: req.session.userId,
                isAdmin: req.session.isAdmin,
                isJury: req.session.isJury,
                title: 'Vote du Jury - En Attente',
                view: '../jury/no-session', // Assumes you have a simple view for this
                css: ['jury-vote-style.css'], // Can still use the style for consistency
                js: ['jury-vote.js', 'sweet-alert.js'] // Load JS for polling
            });
        }

        const sessionId = activeSession[0].id;
        
        const [propositions] = await db.query(`
            SELECT p.*,
                   ps.voting_session_id,
                   GROUP_CONCAT(CASE WHEN i.type = 'before' THEN i.filename END) AS before_images,
                   GROUP_CONCAT(CASE WHEN i.type = 'after' THEN i.filename END) AS after_images
            FROM propositions p
            JOIN proposition_status ps ON p.id = ps.proposition_id
            LEFT JOIN images i ON p.id = i.proposition_id
            WHERE ps.voting_session_id = ?
            GROUP BY p.id, ps.voting_session_id
            ORDER BY p.id ASC
        `, [sessionId]);

        const [userVotes] = await db.query(
            'SELECT proposition_id, vote_value FROM votes WHERE session_id = ? AND user_id = ?',
            [sessionId, userId]
        );

        res.render('layouts/main', {
            username: req.session.username,
            userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            propositions: propositions,
            userVotes: userVotes,
            sessionId: sessionId,
            title: 'Vote du Jury',
            view: '../jury/jury-vote',
            // THIS IS THE KEY CHANGE:
            css: ['detailProposition.css', 'jury-vote-style.css'],
            js: ['jury-vote.js', 'sweet-alert.js']
        });

    } catch (error) {
        console.error(`Erreur lors de la récupération du vote du jury : ${error.message}`);
        // Consider using a proper error page here instead of just sending text
        res.status(500).render('errors/500', { // Assumes you have an error view
            username: req.session.username,
            userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            title: "Erreur",
            error: error
        });
    }
});

router.post('/proposition/:id/vote', upload.none(), async (req, res) => {
    const propositionId = req.params.id;
    const { grade } = req.body;
    const userId = req.session.userId;

    try {
        const [activeSession] = await db.query(`
            SELECT id, type FROM voting_sessions WHERE is_active = 1 AND started = 1 AND ended = 0
        `);

        if (activeSession.length === 0) {
            return res.status(400).json({ error: 'Aucune session de vote active trouvée.' });
        }

        const activeSessionId = activeSession[0].id;
        const sessionType = activeSession[0].type;
        
        // Authorization Check
        if (sessionType === 'jury' && !req.session.isJury) {
            return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à voter dans cette session.' });
        }

        const [existingVote] = await db.query(`
            SELECT * FROM votes
            WHERE session_id = ? AND proposition_id = ? AND user_id = ?`,
            [activeSessionId, propositionId, userId]
        );

        if (existingVote.length > 0) {
            await db.query(`
                UPDATE votes
                SET vote_value = ?
                WHERE session_id = ? AND proposition_id = ? AND user_id = ?`,
                [grade, activeSessionId, propositionId, userId]
            );
            return res.status(200).json({ message: 'Votre vote a été mis à jour avec succès.' });
        } else {
            await db.query(`
                INSERT INTO votes (session_id, proposition_id, user_id, vote_value)
                VALUES (?, ?, ?, ?)`,
                [activeSessionId, propositionId, userId, grade]
            );
            return res.status(201).json({ message: 'Votre vote a été soumis avec succès.' });
        }

    } catch (error) {
        console.error('Erreur de base de données:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
});

router.get('/statut-vote', function (req, res) {
    res.render('layouts/main', {
        username: req.session.username, userId: req.session.userId,
        isAdmin: req.session.isAdmin,
        isJury: req.session.isJury,
        title: 'statut',
        css: ['status.css'],
        js: ['status.js'],
        view: '../voting-sessions/status'
    });
});

router.get('/check-active-session', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, type, started, is_active
            FROM voting_sessions
            WHERE is_active = 1 and started = 1 AND ended = 0
            ORDER BY init_time DESC
            LIMIT 1
        `);

        if (rows.length > 0) {
            const session = rows[0];
            res.json({
                success: true,
                sessionType: session.type,
                sessionStarted: session.started,
            });
        } else {
            res.json({ success: false, message: "No active session found" });
        }
    } catch (error) {
        console.error("Error fetching active session:", error);
        res.status(500).json({ success: false, message: "Error fetching session data" });
    }
});

router.get('/global-vote', async (req, res) => {
    try {
        const userId = req.session.userId;

        const [session] = await db.query(`
            SELECT id, type FROM voting_sessions WHERE is_active = 1 AND started = 1 AND ended = 0
        `);

        if (!session[0] || session[0].type !== 'global') {
            return res.status(400).json({ error: 'Aucune session de vote utilisateur en cours' });
        }

        const [userVote] = await db.query(`
            SELECT COUNT(*) as count FROM votes 
            WHERE user_id = ? AND session_id = ?
        `, [userId, session[0].id]);

        if (userVote[0].count > 0) {
            return res.status(403).json({ error: 'Vous avez déjà voté dans cette session' });
        }

        const [propositions] = await db.query(`
    SELECT p.*, 
           GROUP_CONCAT(CASE WHEN i.type = 'before' THEN i.filename END) AS before_images, 
           GROUP_CONCAT(CASE WHEN i.type = 'after' THEN i.filename END) AS after_images
    FROM propositions p
    JOIN proposition_status ps ON p.id = ps.proposition_id
    LEFT JOIN images i ON p.id = i.proposition_id
    WHERE ps.voting_session_id = ?
    GROUP BY p.id
`, [session[0].id]);

        if (propositions.length === 0) {
            return res.status(404).json({ message: 'Aucune proposition disponible pour le vote' });
        }


        res.render('layouts/main', {
            username: req.session.username, userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            propositions: propositions,
            title: 'Vote Global',
            view: '../voting-sessions/global-vote.ejs',
            css: ['detailProposition.css'],
            js: ['global-vote.js', 'sweet-alert.js'],
        });


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur interne du serveur', details: error });
    }
});

router.post('/global-vote/submit', async (req, res) => {

    const { votes } = req.body;
    const userId = req.session.userId;

    try {
        const [session] = await db.query(`
            SELECT id, type FROM voting_sessions WHERE is_active = 1 AND started = 1 AND ended = 0
        `);

        if (!session[0] || session[0].type !== 'global') {
            return res.status(400).json({ error: 'Aucune session de vote utilisateur en cours' });
        }

        const [userVote] = await db.query(`
            SELECT COUNT(*) as count FROM votes 
            WHERE user_id = ? AND session_id = ?
        `, [userId, session[0].id]);

        if (userVote[0].count > 0) {
            return res.status(403).json({ error: 'Vous avez déjà voté dans cette session' });
        }
        const connection = await db.getConnection();
        let votePromises;
        try {
            await connection.beginTransaction();

            votePromises = votes.map(vote =>
                connection.query(`
                INSERT INTO votes (session_id, proposition_id, user_id, vote_value)
                VALUES (?, ?, ?, ?)
            `, [session[0].id, vote.propositionId, userId, vote.value ? vote.value : 0])
            );
            await Promise.all(await votePromises);
            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        res.status(201).json({ message: 'Votes soumis avec succès' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur lors de la soumission des votes', details: error });
    }
});

router.get('/:id/resultats-votes-global', async (req, res) => {
    try {
        const sessionId = req.params.id;

        const [session] = await db.query('SELECT * FROM voting_sessions WHERE id = ?', [sessionId]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        if (!session[0].ended && !req.session.isAdmin) {
            return res.redirect('/propositions/mes-propositions');
        }

        const [propositionsStatus] = await db.query(`
            SELECT 
                ps.proposition_id, 
                ps.is_validated, 
                ps.average_grade, 
                p.id, 
                p.display_id,
                p.date_emission,
                CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                p.objet,
                p.description_situation_actuelle,
                p.description_amelioration_proposee,
                p.impact_economique, 
                p.impact_technique, 
                p.impact_formation, 
                p.impact_fonctionnement 
            FROM proposition_status ps
            JOIN propositions p ON ps.proposition_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ps.voting_session_id = ?
        `, [sessionId]);

        if (propositionsStatus.length === 0) {
            return res.status(404).json({ message: 'Aucune proposition trouvée pour cette session' });
        }

        // Sort propositions into categories based on impacts
        const economicImpactPropositions = propositionsStatus
            .filter(prop => prop.impact_economique)
            .sort((a, b) => b.average_grade - a.average_grade);
        const technicalImpactPropositions = propositionsStatus
            .filter(prop => prop.impact_technique)
            .sort((a, b) => b.average_grade - a.average_grade);
        const trainingImpactPropositions = propositionsStatus
            .filter(prop => prop.impact_formation)
            .sort((a, b) => b.average_grade - a.average_grade);
        const operationalImpactPropositions = propositionsStatus
            .filter(prop => prop.impact_fonctionnement)
            .sort((a, b) => b.average_grade - a.average_grade);

        res.render('layouts/main', {
            username: req.session.username, userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            session: session[0],
            sessionId,
            economicImpactPropositions,
            technicalImpactPropositions,
            trainingImpactPropositions,
            operationalImpactPropositions,
            title: 'Details session',
            view: '../voting-sessions/global-vote-results',
            css: ['global-vote-results.css'],
            js: ['sweet-alert.js']
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur de base de données', details: error });
    }
});

router.get('/:id', async (req, res) => {
    // UPDATED ACCESS: Allow admin or jury members
    if (!req.session.isAdmin && !req.session.isJury) {
        return res.redirect('/propositions/mes-propositions');
    }

    try {
        const sessionId = req.params.id;

        const [session] = await db.query('SELECT * FROM voting_sessions WHERE id = ?', [sessionId]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        // REMOVED THE FAULTY REDIRECT. Now both admins and jury can see active/ended sessions.
        // The view will handle hiding admin-only controls.

        const [propositionsStatus] = await db.query(`
            SELECT 
                ps.proposition_id, 
                ps.is_validated,
                ps.average_grade,
                p.id,
                p.display_id,
                p.date_emission,
                CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS full_name,
                COALESCE(p.objet, p.description_situation_actuelle) as objet,
                p.description_situation_actuelle,
                p.description_amelioration_proposee,
                p.is_excluded
            FROM proposition_status ps
            JOIN propositions p ON ps.proposition_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE ps.voting_session_id = ?
        `, [sessionId]);

        if (propositionsStatus.length === 0) {
            return res.status(404).json({ message: 'Aucune proposition trouvée pour cette session' });
        }

        res.render('layouts/main', {
            username: req.session.username, userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            session: session[0],
            propositions: propositionsStatus,
            sessionId,
            title: 'Details session',
            view: '../voting-sessions/details',
            css: ['tables.css'],
            js: ['sweet-alert.js', 'ag-grid.js']
        });
    } catch (error) {
        console.error("Error fetching session details:", error);
        res.status(500).json({ error: 'Erreur de base de données', details: error });
    }
});


router.get('/status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [[session]] = await db.query(
            'SELECT is_active, started, ended FROM voting_sessions WHERE id = ?',
            [id]
        );

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        
        const isOver = !session.is_active || session.ended;

        res.json({ success: true, isOver });

    } catch (error) {
        console.error('Error fetching session status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;