const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadDir;
    try {
      if (file.fieldname.startsWith('profileImage')) {
        uploadDir = path.join(__dirname, '../uploads/private/profile_images');
      } else {
        const propositionId = req.params.propositionId;
        const type = file.fieldname.includes('before') ? 'before' : 'after';

        const existingCount = await getExistingImageCount(propositionId, type);
        const currentUploads = req.files?.[file.fieldname]?.length || 0;
        const maxAllowed = 3;

        if (existingCount + currentUploads >= maxAllowed) {
          return cb(new Error(`Vous ne pouvez pas télécharger plus de ${maxAllowed} images pour "${type}".`));
        }

        uploadDir = path.join(__dirname, '../uploads/private/propositions', `proposition_${propositionId}`, type);
      }

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    } catch (error) {
      console.error('Erreur lors de la détermination du répertoire de téléchargement:', error);
      cb(new Error('Erreur lors de la détermination du répertoire de téléchargement.'));
    }
  },
  filename: (req, file, cb) => {
    if (file.fieldname.startsWith('profileImage')) {
      const userId = req.params.userId;
      cb(null, `profileimg-${userId}${path.extname(file.originalname)}`);
    } else {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier invalide. Seules les images sont autorisées.'));
  }
};

const limits = {
  fileSize: 1024 * 1024 * 5
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

module.exports = upload;

async function getExistingImageCount(propositionId, type) {
  const [existingImages] = await db.query(
    'SELECT COUNT(*) AS count FROM images WHERE proposition_id = ? AND type = ?',
    [propositionId, type]
  );
  return existingImages[0].count;
}
