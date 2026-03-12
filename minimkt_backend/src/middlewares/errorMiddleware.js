const errorMiddleware = (err, req, res, next) => {
    console.error("Error global: ", err);

    if (err.name === "ZodError"){
        return res.status(400).json({
            errors: err.issues.map(issue => issue.message)
        });
    }

    if (err.statusCode) {
        return res.status(err.statusCode).json({
            message: err.message
        });
    }

    return res.status(500).json({
        message: "Erro interno do servidor"
    });
};
module.exports = { errorMiddleware };