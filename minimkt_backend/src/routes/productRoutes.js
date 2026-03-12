const express = require("express");
const router = express.Router();

const {
    verifyTokenMiddleware,
    verifyOptionalTokenMiddleware
} = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/roleMiddleware");
const { uploadProductImageMiddleware } = require("../middlewares/uploadMiddleware");
const {
    createProductController,
    updateProductController,
    deleteProductController,
    listProductsController,
    listMyProductsController,
    getProductByIdController,
    listCategoriesController,
    createCategoryController,
    uploadProductImageController
} = require("../controllers/productController");

router.post(
    "/",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    createProductController
);
router.patch(
    "/:id",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    updateProductController
);
router.delete(
    "/:id",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    deleteProductController
);
router.post(
    "/upload-image",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    uploadProductImageMiddleware,
    uploadProductImageController
);

router.get(
    "/my",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    listMyProductsController
);
router.post(
    "/categories",
    verifyTokenMiddleware,
    requireRole(["seller", "admin"]),
    createCategoryController
);
router.get("/categories", listCategoriesController);
router.get("/", verifyOptionalTokenMiddleware, listProductsController);
router.get("/:id", verifyOptionalTokenMiddleware, getProductByIdController);

module.exports = router;
