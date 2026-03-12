const db = require("../database/connection");

const createProduct = async (data, user) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        let sellerId;

        if (user.role === "admin" && data.seller_id){
            sellerId = data.seller_id;
        } else {
            sellerId = user.userId
        }

        const categoryCheck = await client.query(
            "SELECT id FROM categories WHERE id = $1",
            [data.category_id]
        );

        if (categoryCheck.rowCount === 0) {
            throw new Error("Categoria não encontrada");
        }

        const productResult = await client.query(
            'INSERT INTO products (seller_id, category_id, title, description, price, stock) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [
                sellerId,
                data.category_id,
                data.title,
                data.description,
                data.price,
                data.stock
            ]
        );

        const product = productResult.rows[0];
        if(data.images && data.images.length > 0) {
            for (const image of data.images) {
                await client.query(
                    'INSERT INTO product_images (product_id, url, is_primary) VALUES ($1,$2,$3)',
                    [product.id, image.url, image.is_primary || false]
                );
            }
        }

        await client.query("COMMIT");

        return product;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const listProducts = async (filters, user) => {
    const {
        page = 1,
        limit = 10,
        search,
        minPrice,
        maxPrice,
        category
    } = filters;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let query = ' SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';

    const conditions = [];
    const values = [];
    let index = 1;

    if (!user || user.role === "buyer") {
        conditions.push(`p.status = 'active'`); 
    }

    if (search) {
        conditions.push(`p.title ILIKE $${index}`);
        values.push(`%${search}%`);
        index++;
    }

    if (minPrice) {
        conditions.push(`p.price >= $${index}`);
        values.push(minPrice);
        index++;
    }

    if (maxPrice) {
        conditions.push(`p.price <= $${index}`);
        values.push(maxPrice);
        index++;
    }

    if (category) {
        conditions.push(`p.category_id = $${index}`);
        values.push(category);
        index++;
    }

    if (user && user.role === "seller") {
        conditions.push(`p.seller_id = $${index}`);
        values.push(user.userId);
        index++;
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${index} OFFSET $${index + 1}`;

    values.push(limitNumber, offset);

    const result = await db.query(query, values);

    return result.rows;

};

const getProductById = async (productId, user) => {
    let query = ` SELECT p.*, c.name AS category_name 
    FROM products p LEFT JOIN categories c ON 
    p.category_id = c.id WHERE p.id = $1`;
const values = [productId];

const result = await db.query(query, values);

if (result.rowCount === 0) {
    throw new Error("Produto não encontrado");
}

const product = result.rows[0];

if (user && user.role === "seller") {
    if (
        product.seller_id !== "active"
    ) {
        throw new Error("Acesso negado");
    }
}

const imagesResult = await db.query(
    "SELECT id, url, is_primary FROM product_images WHERE product_id = $1",
    [productId]
);
product.images = imagesResult.rows;
return product;
};

module.exports = { createProduct, listProducts, getProductById };