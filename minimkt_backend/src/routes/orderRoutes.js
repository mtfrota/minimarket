const express = require("express");
const router = express.Router();
const { verifyTokenMiddleware } =  require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/roleMiddleware");
const { createOrderController, cleanupExpiredOrdersController, getOrderCheckoutSummaryController, cancelMyPendingOrdersController, getMyOrdersController } = require("../controllers/orderController");
const { 
    paymentOrderController,
    getPixPaymentController,
    confirmPixPaymentController,
    getDebitQrPaymentController,
    confirmDebitQrPaymentController
    } = require("../controllers/paymentController");
const { getMyPaymentHistoryController } = require("../controllers/paymentController");

router.post(
    "/",
    verifyTokenMiddleware,
    requireRole("buyer"),
    createOrderController
);
router.post(
    "/cleanup-expired",
    cleanupExpiredOrdersController
);
router.post(
    "/cancel-my-pending",
    verifyTokenMiddleware,
    requireRole("buyer"),
    cancelMyPendingOrdersController
);
router.get(
    "/my",
    verifyTokenMiddleware,
    requireRole("buyer"),
    getMyOrdersController
);
router.get(
    "/:id/checkout-summary",
    verifyTokenMiddleware,
    requireRole("buyer"),
    getOrderCheckoutSummaryController
);
router.get(
    "/payments/my-history",
    verifyTokenMiddleware,
    requireRole("buyer"),
    getMyPaymentHistoryController
);
router.post(
    "/:id/pay",
    verifyTokenMiddleware,
    requireRole("buyer"),
    paymentOrderController
);
router.get(
    "/pix/:public_token",
    getPixPaymentController
);
router.post(
    "/pix/:public_token/confirm",
    confirmPixPaymentController
);
router.get(
    "/debit/:public_token",
    getDebitQrPaymentController
);

router.post(
    "/debit/:public_token/confirm",
    confirmDebitQrPaymentController
);

module.exports = router;
