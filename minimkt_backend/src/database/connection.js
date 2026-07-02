require("dotenv").config();

const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";
const requiresSsl =
    process.env.DB_SSL === "true" ||
    isProduction ||
    process.env.DATABASE_URL?.includes("sslmode=require");

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL
    }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT || 5432),
    };

const pool = new Pool({
    ...poolConfig,
    ...(requiresSsl
        ? {
            ssl: {
                rejectUnauthorized: false
            }
        }
        : {})
});

module.exports = pool;
