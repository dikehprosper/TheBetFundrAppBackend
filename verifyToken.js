/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const jwt = require('jsonwebtoken');
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
                if (err) {
                    return res.status(403).json({ success: 403, message: "Token is not valid", status: 403 });
                }
                req.user = user;
                next();
            });
        } else {
            res.status(403).send('Token missing');
        }
    } else {
        res.status(403).send('Authorization header missing');
    }
};

module.exports = verifyToken;
