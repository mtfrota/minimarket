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

const verifyOptionalTokenMiddleware = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return next();
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return next();
        }

        const decoded = verifyAccessToken(token);
        req.user = decoded;
        return next();
    } catch (_error) {
        return next();
    }
};

module.exports = { verifyTokenMiddleware, verifyOptionalTokenMiddleware };
