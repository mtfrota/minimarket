# Neon setup for MiniMarket

## 1. Create the Neon project

Create a PostgreSQL project in Neon:

- Project name: `minimarket`
- Database name: `minimarket`
- Region: closest available region

Copy the connection string. It should look like:

```env
postgresql://USER:PASSWORD@HOST.neon.tech/minimarket?sslmode=require
```

## 2. Create the schema

Open the Neon SQL Editor and run:

```sql
-- Paste the contents of sql/neon_schema.sql here.
```

The schema file creates the tables, indexes, and `payment_transaction_seq` expected by the current backend.

## 3. Configure backend environment variables

Use `.env.example` as the template for Render/Railway:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/minimarket?sslmode=require
DB_SSL=true
JWT_SECRET=replace-with-a-strong-secret
JWT_REFRESH_SECRET=replace-with-a-different-strong-secret
FRONTEND_URL=https://your-minimarket.vercel.app
BACKEND_URL=https://your-minimarket-api.onrender.com
CORS_ORIGINS=https://your-minimarket.vercel.app
ENABLE_CRON=true
PORT=3000
```

## 4. First seller account

The public registration flow creates `buyer` users. To access `/seller`, register one account normally, then promote it in Neon:

```sql
UPDATE users
SET role = 'seller'
WHERE email = 'seller@example.com';
```

Use `admin` instead of `seller` only when you want that account to manage all sellers' products.

## 5. Frontend environment variable

In Vercel, configure the frontend with:

```env
NEXT_PUBLIC_API_URL=https://your-minimarket-api.onrender.com
```
