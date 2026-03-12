const { z } = require("zod");

const imageSchema = z.object({
    url: z.string().min(5, "URL da imagem invalida"),
    is_primary: z.boolean().optional()
});

const createProductSchema = z.object({
    title: z
        .string()
        .min(3, "Titulo deve ter no minimo 3 caracteres")
        .max(200, "Titulo muito longo"),

    description: z
        .string()
        .min(10, "Descricao deve ter no minimo 10 caracteres"),

    price: z
        .coerce.number({
            required_error: "O preco e obrigatorio",
            invalid_type_error: "Preco deve ser numero"
        })
        .int("O preco deve ser inteiro (centavos)")
        .min(0, "Preco nao pode ser negativo"),

    stock: z
        .coerce.number({
            required_error: "Estoque e obrigatorio",
            invalid_type_error: "Estoque deve ser numero"
        })
        .int("Estoque deve ser inteiro")
        .min(0, "Estoque nao pode ser negativo"),

    category_id: z
        .string()
        .uuid("Categoria invalida"),

    seller_id: z
        .string()
        .uuid("Vendedor invalido")
        .optional(),

    images: z
        .array(imageSchema)
        .optional(),

    status: z
        .enum(["active", "inactive"])
        .optional()
});

const updateProductSchema = z.object({
    title: z
        .string()
        .min(3, "Titulo deve ter no minimo 3 caracteres")
        .max(200, "Titulo muito longo")
        .optional(),

    description: z
        .string()
        .min(10, "Descricao deve ter no minimo 10 caracteres")
        .optional(),

    price: z
        .coerce.number({
            invalid_type_error: "Preco deve ser numero"
        })
        .int("O preco deve ser inteiro (centavos)")
        .min(0, "Preco nao pode ser negativo")
        .optional(),

    stock: z
        .coerce.number({
            invalid_type_error: "Estoque deve ser numero"
        })
        .int("Estoque deve ser inteiro")
        .min(0, "Estoque nao pode ser negativo")
        .optional(),

    category_id: z
        .string()
        .uuid("Categoria invalida")
        .optional(),

    seller_id: z
        .string()
        .uuid("Vendedor invalido")
        .optional(),

    images: z
        .array(imageSchema)
        .optional(),

    status: z
        .enum(["active", "inactive"])
        .optional()
});

module.exports = { createProductSchema, updateProductSchema };
