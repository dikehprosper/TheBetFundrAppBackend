/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const jwt = require('jsonwebtoken')
const tokenVlaue = "especeproject"
module.exports = function(req, res, next) {
    const token = req.header('auth-token')
    if(!token) return res.status(401).send('Access denied')

    try {
        const verified = jwt.verify(token, tokenVlaue)
        req.user = verified;
        next();
    }catch (error) {
        res.status(400).send('invalid token')
    }
}