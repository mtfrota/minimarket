const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../database/connection");
const { registerSchema, loginSchema, updateProfileSchema } = require("../validators/authValidator");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../config/jwt");

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token ausente" });
    }

    const storedToken = await db.query("SELECT user_id FROM refresh_tokens WHERE token = $1", [refreshToken]);

    if (storedToken.rows.length === 0) {
      return res.status(403).json({ message: "Refresh invalido" });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const storedUserId = String(storedToken.rows[0].user_id);

    if (String(decoded.userId) !== storedUserId) {
      return res.status(403).json({ message: "Refresh invalido" });
    }

    const userResult = await db.query(
      "SELECT id, role FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const user = userResult.rows[0];
    await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);

    const rotatedRefreshToken = generateRefreshToken({
      userId: user.id,
    });

    await db.query(
      "INSERT INTO refresh_tokens (id, user_id, token) VALUES ($1, $2, $3)",
      [uuidv4(), user.id, rotatedRefreshToken]
    );

    const newAccessToken = generateAccessToken({
      userId: user.id,
      role: user.role || "buyer",
    });

    return res.json({ accessToken: newAccessToken, refreshToken: rotatedRefreshToken });
  } catch (err) {
    next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.issues.map((issue) => issue.message),
      });
    }

    const { name, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await db.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email ja cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at`,
      [uuidv4(), name, normalizedEmail, hashedPassword, "buyer"]
    );

    return res.status(201).json(newUser.rows[0]);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.issues.map((issue) => issue.message),
      });
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    await db.query("INSERT INTO refresh_tokens (id, user_id, token) VALUES ($1, $2, $3)", [uuidv4(), user.id, refreshToken]);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const userResult = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({ user: userResult.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        errors: validation.error.issues.map((issue) => issue.message),
      });
    }

    const { name, email, currentPassword, newPassword } = validation.data;

    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.user.userId]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const user = userResult.rows[0];

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const emailInUse = await db.query("SELECT id FROM users WHERE email = $1 AND id <> $2", [email.toLowerCase(), user.id]);
      if (emailInUse.rowCount > 0) {
        return res.status(400).json({ message: "Email ja cadastrado" });
      }
    }

    let nextPasswordHash = user.password_hash;

    if (newPassword) {
      const matches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!matches) {
        return res.status(400).json({ message: "Senha atual invalida" });
      }
      nextPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedResult = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           password_hash = $3
       WHERE id = $4
       RETURNING id, name, email, role, created_at`,
      [name ?? null, email ? email.toLowerCase() : null, nextPasswordHash, user.id]
    );

    return res.json({
      message: "Perfil atualizado com sucesso",
      user: updatedResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token ausente" });
    }

    await db.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, me, updateMe, logout };
