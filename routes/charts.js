const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/stacked', async (req, res) => {
    try {
        const yearsResult = await db.query(`
            SELECT DISTINCT YEAR(date_emission) AS year
            FROM propositions
            ORDER BY year DESC;
        `);

        const years = yearsResult[0]?.map(row => row.year) || [];
        const monthsByYear = {};

        for (const year of years) {
            const monthsResult = await db.query(`
                SELECT DISTINCT MONTH(date_emission) AS month
                FROM propositions
                WHERE YEAR(date_emission) = ?
                ORDER BY month;
            `, [year]);

            monthsByYear[year] = monthsResult[0]?.map(row => row.month) || [];
        }

        res.render('layouts/main', {
            username: req.session.username,
            userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            years: years,
            monthsByYear: monthsByYear,
            defaultYear: years[0] || null,
            title: 'Propositions Chart',
            css: ['stacked.css', 'chartnav.css'],
            js: ['stacked.js'],
            modules: ['chart.js'],
            view: '../admin/charts/stacked',
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching data');
    }
});

router.get('/stacked-data', async (req, res) => {
    const { year } = req.query;

    try {
        const data = await db.query(`
            SELECT u.username, MONTH(p.date_emission) AS month, COUNT(*) AS proposition_count
            FROM propositions p
            JOIN users u ON p.user_id = u.id
            WHERE YEAR(p.date_emission) = ?
            GROUP BY u.username, month
            ORDER BY u.username, month;
        `, [year]);

        if (!data[0] || data[0].length === 0) {
            return res.status(404).send('No data found for the selected year');
        }

        const formattedData = data[0].reduce((acc, row) => {
            if (!acc[row.username]) acc[row.username] = {};
            acc[row.username][row.month - 1] = row.proposition_count;
            return acc;
        }, {});

        res.json(formattedData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching data');
    }
});
router.get('/pie', async (req, res) => {
    try {
        const yearsResult = await db.query(`
            SELECT DISTINCT YEAR(date_emission) AS year
            FROM propositions
            ORDER BY year DESC;
        `);

        const years = yearsResult[0]?.map(row => row.year) || [];

        res.render('layouts/main', {
            username: req.session.username,
            userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            years: years,
            title: 'Propositions Pie Chart',
            css: ['pie-chart.css', 'chartnav.css'],
            js: ['pie-chart.js'],
            modules: ['chart.js'],
            view: '../admin/charts/pie',
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching years');
    }
});

router.get('/pie-chart-data', async (req, res) => {
    const { years, months } = req.query;

    try {
        const monthYearConditions = months.split(',').map(monthYear => {
            const [month, year] = monthYear.split('-');
            return `(MONTH(date_emission) = ${parseInt(month, 10)} AND YEAR(date_emission) = ${parseInt(year, 10)})`;
        }).join(' OR ');

        const query = `
            SELECT
                MONTH(date_emission) AS month,
                YEAR(date_emission) AS year,
                COUNT(CASE WHEN statut = 'soldee' THEN 1 END) AS nb_propositions_retenu,
                COUNT(CASE WHEN statut = 'en cours' THEN 1 END) AS nb_propositions_en_cours,
                COUNT(*) AS total
            FROM propositions
            WHERE ${monthYearConditions}
            GROUP BY year, month
            ORDER BY year DESC, month ASC;
        `;

        const data = await db.query(query);

        const formattedData = data[0].map(row => ({
            month: `${row.month}-${String(row.year).slice(-2)}`,
            nb_propositions_retenu: row.nb_propositions_retenu,
            nb_propositions_en_cours: row.nb_propositions_en_cours,
            total: row.total,
        }));

        res.json(formattedData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching data');
    }
});


router.get('/years', async (req, res) => {
    try {
        const yearsResult = await db.query(`
            SELECT DISTINCT YEAR(date_emission) AS year
            FROM propositions
            ORDER BY year DESC;
        `);
        const years = yearsResult[0]?.map(row => row.year) || [];
        res.json(years);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching years');
    }
});

router.get('/months', async (req, res) => {
    const { years } = req.query;
    try {
        const yearsArray = years.split(',');
        const placeholders = yearsArray.map(() => '?').join(', ');

        const query = `
            SELECT DISTINCT
                MONTH(date_emission) AS month,
                YEAR(date_emission) AS year
            FROM propositions
            WHERE YEAR(date_emission) IN (${placeholders})
            ORDER BY year DESC, month ASC;
        `;

        const monthsResult = await db.query(query, yearsArray);

        const formattedMonths = monthsResult[0].map(row => ({
            month: row.month,
            year: row.year,
        }));

        res.json(formattedMonths);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching months');
    }
});
router.get('/cumul', async (req, res) => {
    try {
        res.render('layouts/main', {
            username: req.session.username,
            userId: req.session.userId,
            isAdmin: req.session.isAdmin,
            isJury: req.session.isJury,
            title: 'Cumul des Idées Émises',
            css: ['cumul.css', 'chartnav.css'],
            js: ['cumul.js'],
            modules: ['chart.js'],
            view: '../admin/charts/cumul',
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error rendering page');
    }
});


router.get('/cumul-data', async (req, res) => {
    const { startMonth, endMonth } = req.query;

    const [startYear, startMonthNum] = startMonth.split('-');
    const [endYear, endMonthNum] = endMonth.split('-');

    try {
        const query = `
            SELECT
                YEAR(date_emission) AS year,
                MONTH(date_emission) AS month,
                COUNT(*) AS cumul_idee_emises  -- Count all propositions
            FROM propositions
            WHERE DATE_FORMAT(date_emission, '%Y-%m') BETWEEN ? AND ?
            GROUP BY year, month
            ORDER BY year DESC, month ASC;
        `;

        const data = await db.query(query, [`${startYear}-${startMonthNum}`, `${endYear}-${endMonthNum}`]);

        const formattedData = data[0].map(row => ({
            month: row.month,
            year: row.year,
            cumul_idee_emises: row.cumul_idee_emises
        }));

        res.json(formattedData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching cumulative data');
    }
});

module.exports = router;