const db = require("../database/connection");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://192.168.1.42:3001";
const logPaymentEvent = async (
    client,
    {
        paymentId,
        eventType,
        status,
        message,
        gatewayResponse = null,
        ipAddress = null,
        userAgent = null
    }
) => {
    await client.query(
        `INSERT INTO payment_logs
        (id, payment_id, event_type, status, message, gateway_response, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            uuidv4(),
            paymentId,
            eventType,
            status,
            message,
            gatewayResponse ? JSON.stringify(gatewayResponse) : null,
            ipAddress,
            userAgent
        ]
    );
};

const createPixPayment = async (orderId, requestInfo = {}) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT * FROM orders
            WHERE id = $1
            FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rowCount === 0) {
            const error = new Error("Pedido não encontrado");
            error.statusCode = 404;
            throw error;
        }

        const order = orderResult.rows[0];

        if (order.status === "paid") {
            throw Object.assign(new Error("Pedido já foi pago"), { statusCode: 400});
        }

        if (order.status === "cancelled") {
            throw Object.assign(new Error("Pedido cancelado"), { statusCode: 400 });
        }

        if (new Date(order.expires_at) < new Date()) {
            throw Object.assign(new Error("Pedido expirado."), { statusCode: 400});
        }

        const previousPayments = await client.query(
            `SELECT id
            FROM payments
            WHERE order_id = $1
            AND status = 'pending'`,
            [orderId]
        );

        await client.query(
            `UPDATE payments
            SET status = 'rejected',
                error_message = 'Nova tentativa iniciada',
                processed_at = NOW()
            WHERE order_id = $1
            AND status = 'pending'`,
            [orderId]
        );
        
        for (const prev of previousPayments.rows) {
            await logPaymentEvent(client, {
                paymentId: prev.id,
                eventType: "PAYMENT_REPLACED",
                status: "rejected",
                message: "Pagamento substituído por nova tentativa",
                ipAddress: requestInfo.ip,
                userAgent: requestInfo.userAgent
            });
        }

        const seqResult = await client.query(
            `SELECT nextval('payment_transaction_seq')`
        );

        const sequence = seqResult.rows[0].nextval;
        const year = new Date().getFullYear();
        const padded = String(sequence).padStart(6, "0");
        const transactionId = `PIX-${year}-${padded}`;

        const publicToken = uuidv4();

        const pixCode = `PIX|ORDER:${order.id}|AMOUNT:${order.total_amount}|TX:${transactionId}`;

        const paymentId = uuidv4();

        await client.query(
            `INSERT INTO payments
            (id, order_id, status, method, transaction_id, amount,  gateway_response, public_token)
            VALUES ($1, $2, 'pending', 'pix', $3, $4, $5, $6)`,
            [
                paymentId,
                order.id,
                transactionId,
                order.total_amount,
                JSON.stringify({
                    pix_code: pixCode,
                    generated_at: new Date(),
                    expires_at: order.expires_at
                }),
                publicToken
            ]
        );

        await logPaymentEvent(client, {
            paymentId: paymentId,
            eventType: "PAYMENT_CREATED",
            status: "pending",
            message: "PIX gerado com sucesso",
            gatewayResponse: {
                transaction_id: transactionId,
                amount: order.total_amount
            },
            ipAddress: requestInfo.ip,
            userAgent: requestInfo.userAgent
        });

        await client.query("COMMIT");

        const qrUrl = `http://localhost:3000/orders/pix/${publicToken}`;
        console.log("QR URL:", qrUrl);
        const qrCodeBase64 = await QRCode.toDataURL(qrUrl);
        console.log("QR gerado tamanho", qrCodeBase64?.length);

        return {
            method: "pix",
            flow: "qr",
            status: "pending",
            transaction_id: transactionId,
            public_token: publicToken,
            qr_code: qrCodeBase64,
            expires_at: order.expires_at
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const getPixPaymentByToken = async (publicToken) => {
    const result = await db.query(
       `SELECT
       p.*,
       o.status AS order_status,
       o.expires_at,
       pr.title AS product_name,
       pr.description AS product_description
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products pr ON pr.id = oi.product_id
       WHERE p.public_token = $1`,
        [publicToken]
    );

    if (result.rowCount === 0) {
        const error = new Error("Pagamento não encontrado");
        error.statusCode = 404;
        throw error;
    }

    const payment = result.rows[0];

    if (payment.status === "approved") {
        return { message: "Pagamento já confirmado."};
    }

    if (payment.order_status === "cancelled") {
        return { message: "Pedido cancelado"};
    }

    if (new Date(payment.expires_at) < new Date()) {
        return { message: "Pedido expirado."};
    }

    const qrURL = `http://192.168.1.42:3001/mobile-pay/${publicToken}`;
    const qrCodeBase64 = await QRCode.toDataURL(qrURL);

    return {
        transaction_id: payment.transaction_id,
        amount: payment.amount,
        expires_at: payment.expires_at,
        server_time: new Date(),
        product: {
            name: payment.product_name,
            description: payment.product_description
        },
        qr_code: qrCodeBase64
    };
};

const confirmPixPayment = async (publicToken, requestInfo = {}) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `SELECT p.*, o.status AS order_status, o.expires_at
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.public_token = $1
            FOR UPDATE`,
            [publicToken]
        );

        if (result.rowCount === 0) {
            const error = new Error("Pagamento não encontrado");
            error.statusCode = 404;
            throw error;    
           }

        const payment = result.rows[0];

        const latestPaymentResult = await client.query(
            `SELECT id
            FROM payments
            WHERE order_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
            [payment.order_id]
        );

        if (latestPaymentResult.rows[0].id !== payment.id) {
            throw Object.assign(
                new Error("Esse pagamento foi substituído por uma nova tentativa."),
                { statusCode: 400}
            );
        }

        if (payment.status !== "pending") {
            throw Object.assign(new Error("Pagamento não está pendente"), { statusCode: 400});
        }

        if (payment.order_status === "cancelled") {
            throw Object.assign(new Error("Pedido cancelado"), { statusCode: 400});
        }

        if (new Date(payment.expires_at) < new Date()) {
            throw Object.assign(new Error("Pedido expirado"), { statusCode: 400});
        }

        await client.query(
            `UPDATE payments
            SET status = 'approved',
                processed_at = NOW()
            WHERE id = $1`,
            [payment.id]
        );

        await logPaymentEvent(client, {
            paymentId: payment.id,
            eventType: "PAYMENT_CONFIRMED",
            status: "approved",
            message: "Pagamento confirmado com sucesso.",
            ipAddress: requestInfo.ip,
            userAgent: requestInfo.userAgent
        });

        await client.query(
            `UPDATE orders
            SET status = 'paid'
            WHERE id = $1`,
            [payment.order_id]
        );

        await client.query("COMMIT");

        return{
            message: "Pagamento confirmado com sucesso.",
            transaction_id: payment.transaction_id
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

};

const getBuyerPaymentHistory = async (buyerId) => {
    const result = await db.query(
        `
        SELECT 
            p.id,
            p.transaction_id,
            p.method,
            p.status,
            p.amount,
            p.created_at,
            p.processed_at,
            o.id AS order_id,
            COALESCE(
                STRING_AGG(DISTINCT oi.product_name_snapshot, ' | '),
                ''
            ) AS product_name,
            COALESCE(
                STRING_AGG(DISTINCT pr.description, ' | '),
                ''
            ) AS product_description
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products pr ON pr.id = oi.product_id
        WHERE o.buyer_id = $1
        GROUP BY p.id, p.transaction_id, p.method, p.status, p.amount, p.created_at, p.processed_at, o.id
        ORDER BY p.created_at DESC
        `,
        [buyerId]
    );

    return result.rows;
};

const createCardPayment = async (orderId, cardData, requestInfo = {}) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT * FROM orders
             WHERE id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rowCount === 0) {
            throw Object.assign(new Error("Pedido não encontrado"), { statusCode: 404 });
        }

        const order = orderResult.rows[0];

        if (order.status === "paid") {
            throw Object.assign(new Error("Pedido já foi pago"), { statusCode: 400 });
        }

        if (order.status === "cancelled") {
            throw Object.assign(new Error("Pedido cancelado"), { statusCode: 400 });
        }

        if (new Date(order.expires_at) < new Date()) {
            throw Object.assign(new Error("Pedido expirado"), { statusCode: 400 });
        }
        const previousPayments = await client.query(
            `SELECT id
             FROM payments
             WHERE order_id = $1
             AND status = 'pending'`,
            [orderId]
        );

        await client.query(
            `UPDATE payments
             SET status = 'rejected',
                 error_message = 'Nova tentativa iniciada',
                 processed_at = NOW()
             WHERE order_id = $1
             AND status = 'pending'`,
            [orderId]
        );

        for (const prev of previousPayments.rows) {
            await logPaymentEvent(client, {
                paymentId: prev.id,
                eventType: "PAYMENT_REPLACED",
                status: "rejected",
                message: "Pagamento substituído por nova tentativa",
                ipAddress: requestInfo.ip,
                userAgent: requestInfo.userAgent
            });
        }

        const installments = cardData.installments;

        if (installments < 1 || installments > 12) {
            throw Object.assign(new Error("Parcelamento inválido"), { statusCode: 400 });
        }

        let rate = 0;

        if (installments === 1) {
            rate = 0;
        } else if (installments <= 6) {
            rate = 0.015;
        } else {
            rate = 0.025;
        }

        const totalWithInterest = Math.round(
            order.total_amount * (1 + rate * installments)
        );

        const installmentValue = Math.round(
            totalWithInterest / installments
        );

        const firstDigit = cardData.number[0];

        let brand = "unknown";
        if (firstDigit === "4") brand = "visa";
        if (firstDigit === "5") brand = "mastercard";
        if (firstDigit === "3") brand = "amex";

        const lastDigit = parseInt(cardData.number.slice(-1));
        const approved = lastDigit % 2 === 0;

        const seqResult = await client.query(
            `SELECT nextval('payment_transaction_seq')`
        );

        const sequence = seqResult.rows[0].nextval;
        const year = new Date().getFullYear();
        const padded = String(sequence).padStart(6, "0");

        const transactionId = `CARD-${year}-${padded}`;

        const paymentId = uuidv4();

        const status = approved ? "approved" : "rejected";

        const gatewayResponse = {
            authorization_code: approved ? `AUTH-${sequence}` : null,
            installments,
            installment_value: installmentValue,
            card_last4: cardData.number.slice(-4),
            brand,
            interest_rate: rate,
            total_with_interest: totalWithInterest,
            approved
        };

        await client.query(
            `INSERT INTO payments
             (id, order_id, status, method, transaction_id, amount, gateway_response)
             VALUES ($1, $2, $3, 'card', $4, $5, $6)`,
            [
                paymentId,
                order.id,
                status,
                transactionId,
                totalWithInterest,
                JSON.stringify(gatewayResponse)
            ]
        );

        await logPaymentEvent(client, {
            paymentId,
            eventType: approved ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED",
            status,
            message: approved
                ? "Pagamento com cartão aprovado."
                : "Cartão recusado pela operadora.",
            gatewayResponse,
            ipAddress: requestInfo.ip,
            userAgent: requestInfo.userAgent
        });

        if (approved) {
            await client.query(
                `UPDATE orders
                 SET status = 'paid'
                 WHERE id = $1`,
                [order.id]
            );
        }

        await client.query("COMMIT");

        if (approved) {
            return {
                method: "card",
                flow: "direct",
                status: "approved",
                transaction_id: transactionId,
                data: {
                    installments,
                    installment_value: installmentValue,
                    total_with_interest: totalWithInterest
                }
            };
        }

        return {
            method: "card",
            flow: "direct",
            status: "rejected",
            transaction_id: transactionId,
            message: "Cartão recusado pela operadora."
        };

            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
};

const createDebitQrPayment = async (orderId, cardData = {}, requestInfo = {}) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const orderResult = await client.query( 
            `SELECT * FROM orders
             WHERE id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rowCount === 0) {
            throw Object.assign(new Error("Pedido nao encontrado"), { statusCode: 404 });
        }

        const order = orderResult.rows[0];

        if (order.status === "paid") {
            throw Object.assign(new Error("Pedido ja foi pago"), { statusCode: 400 });
        }

        if (order.status === "cancelled") {
            throw Object.assign(new Error("Pedido cancelado"), { statusCode: 400 });
        }

        if (new Date(order.expires_at) < new Date()) {
            throw Object.assign(new Error("Pedido expirado"), { statusCode: 400 });
        }

        const previousPayments = await client.query(
            `SELECT id
             FROM payments
             WHERE order_id = $1
             AND status = 'pending'`,
            [orderId]
        );

        await client.query(
            `UPDATE payments
             SET status = 'rejected',
                 error_message = 'Nova tentativa iniciada',
                 processed_at = NOW()
             WHERE order_id = $1
             AND status = 'pending'`,
            [orderId]
        );

        for (const prev of previousPayments.rows) {
            await logPaymentEvent(client, {
                paymentId: prev.id,
                eventType: "PAYMENT_REPLACED",
                status: "rejected",
                message: "Pagamento substituido por nova tentativa",
                ipAddress: requestInfo.ip,
                userAgent: requestInfo.userAgent
            });
        }

        if (!cardData.number || !cardData.holder || !cardData.expiration || !cardData.cvv) {
            throw Object.assign(new Error("Dados do cartao de debito incompletos"), { statusCode: 400 });
        }

        const sanitizedNumber = String(cardData.number).replace(/\D/g, "");
        if (sanitizedNumber.length < 13) {
            throw Object.assign(new Error("Numero de cartao invalido"), { statusCode: 400 });
        }

        const seqResult = await client.query(
            `SELECT nextval('payment_transaction_seq')`
        );

        const sequence = seqResult.rows[0].nextval;
        const year = new Date().getFullYear();
        const padded = String(sequence).padStart(6, "0");

        const transactionId = `DEBIT-${year}-${padded}`;
        const paymentId = uuidv4();
        const publicToken = uuidv4();

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const firstDigit = sanitizedNumber[0];
        let brand = "unknown";
        if (firstDigit === "4") brand = "visa";
        if (firstDigit === "5") brand = "mastercard";
        if (firstDigit === "3") brand = "amex";
        if (firstDigit === "6") brand = "elo";

        await client.query(
            `INSERT INTO payments
             (id, order_id, status, method, transaction_id, amount, public_token, gateway_response)
             VALUES ($1, $2, 'pending', 'debit_qr', $3, $4, $5, $6)`,
            [
                paymentId,
                order.id,
                transactionId,
                order.total_amount,
                publicToken,
                JSON.stringify({
                    type: "debit_qr",
                    expires_at: expiresAt,
                    card_last4: sanitizedNumber.slice(-4),
                    brand,
                    holder: cardData.holder
                })
            ]
        );

        await logPaymentEvent(client, {
            paymentId,
            eventType: "PAYMENT_CREATED",
            status: "pending",
            message: "Debito QR gerado.",
            ipAddress: requestInfo.ip,
            userAgent: requestInfo.userAgent
        });

        await client.query("COMMIT");

        const qrUrl = `${FRONTEND_URL}/mobile-debit/${publicToken}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrUrl);

        return {
            method: "debit_qr",
            flow: "qr",
            status: "pending",
            transaction_id: transactionId,
            public_token: publicToken,
            qr_code: qrCodeBase64,
            expires_at: expiresAt
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const getDebitQrPayment = async (publicToken) => {
    const result = await db.query(
        `
        SELECT p.*, o.status AS order_status, o.expires_at,
               pr.title AS product_name,
               pr.description AS product_description
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products pr ON pr.id = oi.product_id
        WHERE p.public_token = $1
        `,
        [publicToken]
    );

    if (result.rowCount === 0) {
        throw Object.assign(new Error("Pagamento nao encontrado"), { statusCode: 404 });
    }

    const payment = result.rows[0];

    if (payment.status === "approved") {
        return { message: "Pagamento ja confirmado.", status: "approved", paid: true };
    }

    if (payment.order_status === "cancelled") {
        return { message: "Pedido cancelado." };
    }

    if (payment.status !== "pending") {
        return { message: "Pagamento nao esta pendente." };
    }

    const gateway = payment.gateway_response;
    const expiresAt = new Date(gateway.expires_at);

    if (expiresAt < new Date()) {
        return { message: "Pagamento expirado." };
    }

    const qrURL = `${FRONTEND_URL}/mobile-debit/${publicToken}`;
    const qrCodeBase64 = await QRCode.toDataURL(qrURL);

    return {
        transaction_id: payment.transaction_id,
        amount: payment.amount,
        expires_at: expiresAt,
        server_time: new Date(),
        status: payment.status,
        paid: false,
        qr_code: qrCodeBase64,
        card: {
            brand: gateway.brand || "unknown",
            last4: gateway.card_last4 || ""
        },
        product: {
            name: payment.product_name,
            description: payment.product_description
        }
    };
};

const confirmDebitQrPayment = async (publicToken, requestInfo = {}) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT p.*, o.status AS order_status
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.public_token = $1
            FOR UPDATE
            `,
            [publicToken]
        );

        if (result.rowCount === 0) {
            throw Object.assign(new Error("Pagamento nao encontrado"), { statusCode: 404 });
        }

        const payment = result.rows[0];

        const latestPaymentResult = await client.query(
            `SELECT id
             FROM payments
             WHERE order_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [payment.order_id]
        );

        if (latestPaymentResult.rows[0].id !== payment.id) {
            throw Object.assign(new Error("Esse pagamento foi substituido por uma nova tentativa."), { statusCode: 400 });
        }

        if (payment.status !== "pending") {
            throw Object.assign(new Error("Pagamento nao esta pendente"), { statusCode: 400 });
        }

        const gateway = payment.gateway_response;
        const expiresAt = new Date(gateway.expires_at);

        if (expiresAt < new Date()) {
            throw Object.assign(new Error("Pagamento expirado"), { statusCode: 400 });
        }

        await client.query(
            `
            UPDATE payments
            SET status = 'approved',
                processed_at = NOW()
            WHERE id = $1
            `,
            [payment.id]
        );

        await client.query(
            `
            UPDATE orders
            SET status = 'paid'
            WHERE id = $1
            `,
            [payment.order_id]
        );

        await logPaymentEvent(client, {
            paymentId: payment.id,
            eventType: "PAYMENT_CONFIRMED",
            status: "approved",
            message: "Debito QR confirmado.",
            ipAddress: requestInfo.ip,
            userAgent: requestInfo.userAgent
        });

        await client.query("COMMIT");

        return { message: "Pagamento confirmado com sucesso.", transaction_id: payment.transaction_id };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createPixPayment,
    getPixPaymentByToken,
    confirmPixPayment,
    getBuyerPaymentHistory,
    logPaymentEvent,
    createCardPayment,
    createDebitQrPayment,
    getDebitQrPayment,
    confirmDebitQrPayment
};
