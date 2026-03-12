const { createOrderSchema } = require("../validators/orderValidator");
const { createOrder } = require("../services/orderServices");
const { cleanupExpiredOrders } = require("../services/orderServices");
const { getOrderCheckoutSummary } = require("../services/orderServices");
const { cancelAllPendingOrdersForBuyer } = require("../services/orderServices");
const { getBuyerOrdersSummary } = require("../services/orderServices");

const createOrderController = async (req, res, next) => {
    try {
        const validation = createOrderSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.issues.map(issue => issue.message)
            });
        }

        const order = await createOrder(validation.data, req.user);

        return res.status(201).json(order);
    } catch (error) {
        next(error);
    }
};

const cleanupExpiredOrdersController = async (req, res, next) => {
    try {
        const result = await cleanupExpiredOrders();
        return res.json(result);
    } catch (error) {
        next(error);
    }
};

const getOrderCheckoutSummaryController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const summary = await getOrderCheckoutSummary(id, req.user.userId);
        return res.json(summary);
    } catch (error) {
        next(error);
    }
};

const cancelMyPendingOrdersController = async (req, res, next) => {
    try {
        const result = await cancelAllPendingOrdersForBuyer(req.user.userId);
        return res.json(result);
    } catch (error) {
        next(error);
    }
};

const getMyOrdersController = async (req, res, next) => {
    try {
        const orders = await getBuyerOrdersSummary(req.user.userId);
        return res.json(orders);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrderController,
    cleanupExpiredOrdersController,
    getOrderCheckoutSummaryController,
    cancelMyPendingOrdersController,
    getMyOrdersController
};
