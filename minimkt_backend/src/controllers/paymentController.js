const { 
    createPixPayment,
    getPixPaymentByToken,
    confirmPixPayment, 
    getBuyerPaymentHistory, 
    createCardPayment,
    createDebitQrPayment,
    getDebitQrPayment,
    confirmDebitQrPayment
    } = require("../services/paymentServices");

const paymentOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { method } = req.body;

        if (!method) {
            return res.status(400).json({ message: "Método de pagamento é obrigatório"});
        }

        if (method === "pix") {
            const result = await createPixPayment(id, {
                ip: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.json(result);
        }

        if (method === "card") {
            const result = await createCardPayment(id, req.body.card, {
                ip: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.json(result);
        }

        if (method === "debit_qr") {
            const result = await createDebitQrPayment(id, req.body.card, {
                ip: req.ip,
                userAgent: req.headers["user-agent"]
            });

    return res.json(result);
}

        return res.status(400).json({ message: "Método ainda não suportado"});
        
    } catch (error) {
        next(error);
    }
};

const getPixPaymentController = async (req, res, next) => {
    try{
        const { public_token } = req.params;

        const result = await getPixPaymentByToken(public_token);

        return res.json(result);
    } catch (error) {
        next (error);
    }
};

const confirmPixPaymentController = async (req, res, next) => {
    try {
        const { public_token } = req.params;

        const result = await confirmPixPayment(public_token, {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.json(result);
    } catch (error) {
        next(error);
    }
};

const getMyPaymentHistoryController = async (req, res, next) => {
    try {
        console.log("req.user:", req.user);
        console.log("buyerId usado:", req.user.id);

        const buyerId = req.user.userId;
        const history = await getBuyerPaymentHistory(buyerId);

        return res.json(history);
    } catch (error) {
        next(error);
    }
};

const getDebitQrPaymentController = async (req, res, next) => {
    try {
        const { public_token } = req.params;
        const result = await getDebitQrPayment(public_token);
        return res.json(result);
    } catch (error) {
        next(error);
    }
};

const confirmDebitQrPaymentController = async (req, res, next) => {
    try {
        const { public_token } = req.params;
        const result = await confirmDebitQrPayment(public_token, {
            ip: req.ip,
            userAgent: req.headers["user-agent"]
        });
        return res.json(result);
    } catch (error) {
        next(error);
    }
};


module.exports = { paymentOrderController, getPixPaymentController, confirmPixPaymentController, getMyPaymentHistoryController,getDebitQrPaymentController, confirmDebitQrPaymentController };
