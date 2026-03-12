const db = require("../database/connection");
const { v4: uuidv4 } = require("uuid");

function buildProductImageUrlMap(rows) {
    const map = new Map();

    for (const row of rows) {
        const current = map.get(row.product_id) || [];
        current.push({
            id: row.id,
            url: row.url,
            is_primary: row.is_primary
        });
        map.set(row.product_id, current);
    }

    return map;
}

function normalizeImages(images = []) {
    if (!Array.isArray(images) || images.length === 0) {
        return [];
    }

    return images.map((image, index) => ({
        url: image.url,
        is_primary: index === 0 ? true : Boolean(image.is_primary)
    }));
}

async function ensureCategoryExists(client, categoryId) {
    const categoryCheck = await client.query(
        "SELECT id FROM categories WHERE id = $1",
        [categoryId]
    );

    if (categoryCheck.rowCount === 0) {
        const error = new Error("Categoria nao encontrada");
        error.statusCode = 400;
        throw error;
    }
}

async function ensureCanManageProduct(client, productId, user) {
    const productResult = await client.query(
        "SELECT id, seller_id FROM products WHERE id = $1",
        [productId]
    );

    if (productResult.rowCount === 0) {
        const error = new Error("Produto nao encontrado");
        error.statusCode = 404;
        throw error;
    }

    const product = productResult.rows[0];

    if (user.role === "seller" && String(product.seller_id) !== String(user.userId)) {
        const error = new Error("Acesso negado");
        error.statusCode = 403;
        throw error;
    }

    return product;
}

async function saveProductImages(client, productId, images) {
    await client.query("DELETE FROM product_images WHERE product_id = $1", [productId]);

    const normalizedImages = normalizeImages(images);

    for (const image of normalizedImages) {
        await client.query(
            "INSERT INTO product_images (product_id, url, is_primary) VALUES ($1, $2, $3)",
            [productId, image.url, image.is_primary]
        );
    }
}

const createProduct = async (data, user) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const sellerId = user.role === "admin" && data.seller_id
            ? data.seller_id
            : user.userId;

        await ensureCategoryExists(client, data.category_id);

        const productResult = await client.query(
            `INSERT INTO products (seller_id, category_id, title, description, price, stock, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                sellerId,
                data.category_id,
                data.title,
                data.description,
                data.price,
                data.stock,
                data.status || "active"
            ]
        );

        const product = productResult.rows[0];

        if (data.images && data.images.length > 0) {
            await saveProductImages(client, product.id, data.images);
        }

        const imageResult = await client.query(
            "SELECT id, url, is_primary FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, id ASC",
            [product.id]
        );

        await client.query("COMMIT");

        return {
            ...product,
            images: imageResult.rows,
            image_url: imageResult.rows[0]?.url || null
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const updateProduct = async (productId, data, user) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        await ensureCanManageProduct(client, productId, user);

        if (data.category_id) {
            await ensureCategoryExists(client, data.category_id);
        }

        const fields = [];
        const values = [];
        let index = 1;

        const addField = (column, value) => {
            fields.push(`${column} = $${index}`);
            values.push(value);
            index += 1;
        };

        if (typeof data.title !== "undefined") addField("title", data.title);
        if (typeof data.description !== "undefined") addField("description", data.description);
        if (typeof data.price !== "undefined") addField("price", data.price);
        if (typeof data.stock !== "undefined") addField("stock", data.stock);
        if (typeof data.category_id !== "undefined") addField("category_id", data.category_id);
        if (typeof data.status !== "undefined") addField("status", data.status);

        if (user.role === "admin" && typeof data.seller_id !== "undefined") {
            addField("seller_id", data.seller_id);
        }

        let updatedProduct = null;

        if (fields.length > 0) {
            values.push(productId);

            const updateResult = await client.query(
                `UPDATE products
                 SET ${fields.join(", ")}
                 WHERE id = $${index}
                 RETURNING *`,
                values
            );

            if (updateResult.rowCount === 0) {
                const error = new Error("Produto nao encontrado");
                error.statusCode = 404;
                throw error;
            }

            updatedProduct = updateResult.rows[0];
        } else {
            const currentResult = await client.query("SELECT * FROM products WHERE id = $1", [productId]);
            updatedProduct = currentResult.rows[0];
        }

        if (Array.isArray(data.images)) {
            await saveProductImages(client, productId, data.images);
        }

        const imageResult = await client.query(
            "SELECT id, url, is_primary FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, id ASC",
            [productId]
        );

        await client.query("COMMIT");

        return {
            ...updatedProduct,
            images: imageResult.rows,
            image_url: imageResult.rows[0]?.url || null
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const deleteProduct = async (productId, user) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        await ensureCanManageProduct(client, productId, user);

        await client.query(
            `UPDATE products
             SET status = 'inactive', stock = 0
             WHERE id = $1`,
            [productId]
        );

        await client.query("COMMIT");
        return { message: "Produto removido com sucesso" };
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
        category,
        status
    } = filters;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let query = `
        SELECT
            p.*,
            c.name AS category_name,
            (
                SELECT pi.url
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY pi.is_primary DESC, pi.id ASC
                LIMIT 1
            ) AS image_url
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
    `;

    const conditions = [];
    const values = [];
    let index = 1;

    if (!user || user.role === "buyer") {
        conditions.push(`p.status = 'active'`);
    }

    if (search) {
        conditions.push(`p.title ILIKE $${index}`);
        values.push(`%${search}%`);
        index += 1;
    }

    if (minPrice) {
        conditions.push(`p.price >= $${index}`);
        values.push(minPrice);
        index += 1;
    }

    if (maxPrice) {
        conditions.push(`p.price <= $${index}`);
        values.push(maxPrice);
        index += 1;
    }

    if (category) {
        conditions.push(`p.category_id = $${index}`);
        values.push(category);
        index += 1;
    }

    if (user && user.role === "seller") {
        conditions.push(`p.seller_id = $${index}`);
        values.push(user.userId);
        index += 1;
    }

    if (status) {
        conditions.push(`p.status = $${index}`);
        values.push(status);
        index += 1;
    }

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${index} OFFSET $${index + 1}`;
    values.push(limitNumber, offset);

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
        return [];
    }

    const productIds = result.rows.map((item) => item.id);
    const imageResult = await db.query(
        "SELECT id, product_id, url, is_primary FROM product_images WHERE product_id = ANY($1::uuid[]) ORDER BY is_primary DESC, id ASC",
        [productIds]
    );

    const imageMap = buildProductImageUrlMap(imageResult.rows);

    return result.rows.map((item) => ({
        ...item,
        images: imageMap.get(item.id) || []
    }));
};

const listMyProducts = async (user) => {
    return listProducts({ page: 1, limit: 1000, status: "active" }, user);
};

const getProductById = async (productId, user) => {
    const result = await db.query(
        `SELECT
            p.*, c.name AS category_name,
            (
                SELECT pi.url
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY pi.is_primary DESC, pi.id ASC
                LIMIT 1
            ) AS image_url
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [productId]
    );

    if (result.rowCount === 0) {
        const error = new Error("Produto nao encontrado");
        error.statusCode = 404;
        throw error;
    }

    const product = result.rows[0];

    if (user && user.role === "seller" && String(product.seller_id) !== String(user.userId)) {
        const error = new Error("Acesso negado");
        error.statusCode = 403;
        throw error;
    }

    if ((!user || user.role === "buyer") && product.status !== "active") {
        const error = new Error("Produto nao encontrado");
        error.statusCode = 404;
        throw error;
    }

    const imagesResult = await db.query(
        "SELECT id, url, is_primary FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, id ASC",
        [productId]
    );

    return {
        ...product,
        images: imagesResult.rows
    };
};

const listCategories = async () => {
    const result = await db.query(
        "SELECT id, name FROM categories ORDER BY name ASC"
    );

    return result.rows;
};

const createCategory = async (name) => {
    const normalizedName = String(name || "").trim();

    if (!normalizedName) {
        const error = new Error("Nome da categoria e obrigatorio");
        error.statusCode = 400;
        throw error;
    }

    const existing = await db.query(
        "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
        [normalizedName]
    );

    if (existing.rowCount > 0) {
        return existing.rows[0];
    }

    const created = await db.query(
        "INSERT INTO categories (id, name) VALUES ($1, $2) RETURNING id, name",
        [uuidv4(), normalizedName]
    );

    return created.rows[0];
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    listProducts,
    listMyProducts,
    getProductById,
    listCategories,
    createCategory
};
