const { createProductSchema } = require("../validators/productValidator");
const { createProduct } = require("../services/productServices");

const createProductController = async (req, res, next) => {
    try {
        const validation = createProductSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                errors: validation.error.issues.map(issue => issue.message)
            });
        }

        const product = await createProduct(validation.data, req.user);

        return res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};

const { listProducts } = require("../services/productServices");
const listProductsController = async (req, res, next) => {
    try {
        const products = await listProducts(req.query, req.user);
        return res.json(products);
    } catch (error){
        next(error);
    }
};

const { getProductById } = require("../services/productServices");
const getProductByIdController = async (req, res, next) => {
    try{
        const product = await getProductById(req.params.id, req.user);
        return res.json(product);
    } catch (error) {
        next(error);
    }
};

module.exports = { 
    createProductController,
    listProductsController, 
    getProductByIdController
 };