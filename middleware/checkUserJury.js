function isJury(req, res, next) {
    if (req.session.isJury) {
        next();
    } else {
        res.redirect('/');
    }
}
module.exports = isJury;
