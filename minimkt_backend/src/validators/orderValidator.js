const { z } = require("zod");

const orderItemSchema = z.object({
    product_id: z
        .string()
        .uuid("Produto inválido"),

    quantity: z
        .number({
            required_error: "Quantidade é obrigatória",
            invalid_type_error: "Quantidade deve ser número"
        })
        .int("Quantidade deve ser inteira")
        .min(1, "Quantidade deve ser maior que zero")
});

const createOrderSchema = z.object({
    items: z
        .array(orderItemSchema)
        .min(1, "O pedido precisa ter pelo menos 1 item")
});

module.exports = { createOrderSchema };