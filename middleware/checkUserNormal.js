function isNormalUser(req, res, next) {
    if (req.session && req.session.user && req.session.user.is_user) {
        next();
    } else {
        res.redirect('/');
    }
}
module.exports = isNormalUser;
