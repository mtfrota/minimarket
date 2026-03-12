const express = require("express");
const router = express.Router();

const { verifyTokenMiddleware } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/roleMiddleware");
const { createProductController, listProductsController, getProductByIdController } = require("../controllers/productController");

router.post(
    "/",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    createProductController
);
router.get("/", listProductsController);
router.get("/:id", getProductByIdController);

module.exports = router;