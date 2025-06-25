const db = require('../config/db');

async function checkUserOwnership(req, res, next) {
  const propositionId = req.params.propositionId;
  const userId = req.session.userId;

  try {
    const [result] = await db.query(
      'SELECT user_id FROM propositions WHERE id = ?',
      [propositionId]
    );
    
    if (result.length > 0 && result[0].user_id === userId) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Forbidden: You do not own this proposition.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}
module.exports = checkUserOwnership;
