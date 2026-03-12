const { verifyAccessToken } = require("../config/jwt");

const verifyTokenMiddleware = (req, res, next ) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "Token não fornecido" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = verifyAccessToken(token);

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido ou expirado" });
    }
};

module.exports = { verifyTokenMiddleware };