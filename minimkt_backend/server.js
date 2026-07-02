require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const defaultAllowedOrigins = [
  "http://localhost:3001"
];

const envAllowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem nao permitida pelo CORS"));
  }
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./src/routes/authRoutes");
app.use("/auth", authRoutes);

const productRoutes = require("./src/routes/productRoutes");
app.use("/products", productRoutes);

const orderRoutes = require("./src/routes/orderRoutes");
app.use("/orders", orderRoutes);

const { startCleanupJob } = require("./src/jobs/cleanupJob");
  if (process.env.ENABLE_CRON === "true") {
    console.log("Cleanup automático ativado.");
    startCleanupJob();
  }


const { errorMiddleware } = require("./src/middlewares/errorMiddleware");
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
