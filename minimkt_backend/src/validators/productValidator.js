const { z } = require("zod");

const imageSchema = z.object({
    url: z
        .string()
        .min(5, "URL da imagem inválida"),
    is_primary: z.boolean().optional()
});

const createProductSchema = z.object({
    title: z
        .string()
        .min(3, "Titulo deve ter o minímo 3 caracteres")
        .max(200, "Titulo muito longo"),

    description: z
        .string()
            .min(10, "Descrição deve ter no minímo 10 caracteres"),

    price: z
        .number({
            required_error: "O preço é obrigatório",
            invalid_type_error: "Preço deve ser número"
        })
        .int("O preço deve ser inteiro (centavos)")
        .min(0, "Preço não pode ser negativo"),

    stock: z
        .number({
            required_error: "Estoque é obrigatório",
            invalid_type_error: "Estoque deve ser número"
        })
        .int("Estoque deve ser inteiro")
        .min(0, "Estoque não pode ser negativo"),

    category_id: z
        .string()
        .uuid("Categoria inválida"),

    seller_id: z
        .string()
        .uuid("Vendedor inválido")
        .optional(),

    images: z
        .array(imageSchema)
        .optional()
});

module.exports = { createProductSchema };