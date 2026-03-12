require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3001",
    "http://192.168.1.42:3001"
  ]
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
