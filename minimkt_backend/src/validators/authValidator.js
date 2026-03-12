const { z } = require("zod");

const registerSchema = z.object({
    name: z.string().min(1, "Nome e obrigatorio"),
    email: z.string().email("Email invalido"),
    password: z.string()
        .min(8, "Senha deve ter no minimo 8 caracteres.")
        .regex(/[A-Z]/, "Precisa ter letra maiuscula")
        .regex(/[a-z]/, "Precisa ter letra minuscula")
        .regex(/[0-9]/, "Precisa ter numeros")
        .regex(/[^A-Za-z0-9]/, "Precisa ter caracter especial")
});

const loginSchema = z.object({
    email: z.string().email("Email invalido"),
    password: z.string().min(1, "Senha e obrigatoria."),
});

const updateProfileSchema = z
    .object({
        name: z.string().min(1, "Nome e obrigatorio").optional(),
        email: z.string().email("Email invalido").optional(),
        currentPassword: z.string().min(1, "Senha atual e obrigatoria").optional(),
        newPassword: z.string()
            .min(8, "Senha deve ter no minimo 8 caracteres.")
            .regex(/[A-Z]/, "Precisa ter letra maiuscula")
            .regex(/[a-z]/, "Precisa ter letra minuscula")
            .regex(/[0-9]/, "Precisa ter numeros")
            .regex(/[^A-Za-z0-9]/, "Precisa ter caracter especial")
            .optional()
    })
    .superRefine((data, ctx) => {
        if (data.newPassword && !data.currentPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["currentPassword"],
                message: "Informe a senha atual para alterar a senha"
            });
        }

        if (!data.name && !data.email && !data.newPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Informe ao menos um campo para atualizar"
            });
        }
    });

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
};
