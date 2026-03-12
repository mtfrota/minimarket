const {
    createProductSchema,
    updateProductSchema
} = require("../validators/productValidator");
const {
    createProduct,
    updateProduct,
    deleteProduct,
    listProducts,
    listMyProducts,
    getProductById,
    listCategories,
    createCategory
} = require("../services/productServices");

const createProductController = async (req, res, next) => {
    try {
        const validation = createProductSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.issues.map((issue) => issue.message)
            });
        }

        const product = await createProduct(validation.data, req.user);

        return res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};

const updateProductController = async (req, res, next) => {
    try {
        const validation = updateProductSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.issues.map((issue) => issue.message)
            });
        }

        const product = await updateProduct(req.params.id, validation.data, req.user);
        return res.json(product);
    } catch (error) {
        next(error);
    }
};

const deleteProductController = async (req, res, next) => {
    try {
        const result = await deleteProduct(req.params.id, req.user);
        return res.json(result);
    } catch (error) {
        next(error);
    }
};

const listProductsController = async (req, res, next) => {
    try {
        const products = await listProducts(req.query, req.user);
        return res.json(products);
    } catch (error) {
        next(error);
    }
};

const listMyProductsController = async (req, res, next) => {
    try {
        const products = await listMyProducts(req.user);
        return res.json(products);
    } catch (error) {
        next(error);
    }
};

const getProductByIdController = async (req, res, next) => {
    try {
        const product = await getProductById(req.params.id, req.user);
        return res.json(product);
    } catch (error) {
        next(error);
    }
};

const listCategoriesController = async (_req, res, next) => {
    try {
        const categories = await listCategories();
        return res.json(categories);
    } catch (error) {
        next(error);
    }
};

const createCategoryController = async (req, res, next) => {
    try {
        const category = await createCategory(req.body?.name);
        return res.status(201).json(category);
    } catch (error) {
        next(error);
    }
};

const uploadProductImageController = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Imagem nao enviada" });
        }

        const relativePath = `/uploads/products/${req.file.filename}`;
        const fullUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

        return res.status(201).json({
            url: fullUrl,
            path: relativePath,
            filename: req.file.filename
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProductController,
    updateProductController,
    deleteProductController,
    listProductsController,
    listMyProductsController,
    getProductByIdController,
    listCategoriesController,
    createCategoryController,
    uploadProductImageController
};
