# MiniMarket

MiniMarket is a full-stack marketplace prototype with product catalog, cart, checkout, simulated payments, buyer history, and a seller dashboard.

The project is split into two apps:

- `minimkt-front`: Next.js frontend.
- `minimkt_backend`: Express API with PostgreSQL.

## Features

- Buyer registration and login with JWT access/refresh tokens.
- Product listing, filtering, cart, and checkout.
- Simulated payments with credit card, PIX QR, and debit QR.
- Buyer pages for orders and payment history.
- Seller/admin dashboard with products, categories, image upload, stock, charts, and sales summary.
- Light/dark theme with persisted preference.
- Neon-compatible PostgreSQL schema.

## Stack

Frontend:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Lottie

Backend:

- Node.js
- Express
- PostgreSQL with `pg`
- JWT
- bcryptjs
- Multer
- Zod
- node-cron
- qrcode

## Project Structure

```text
MiniMarket/
  minimkt-front/       # Next.js app
  minimkt_backend/     # Express API
    sql/neon_schema.sql
    NEON_DEPLOY.md
  imagens-produtos/    # Local reference images
```

## Requirements

- Node.js 20+
- npm
- PostgreSQL database, preferably Neon for online deploy

## Database Setup

The backend expects PostgreSQL tables for users, products, orders, payments, and logs.

For Neon:

1. Create a Neon project.
2. Open the Neon SQL Editor.
3. Run the schema in:

```text
minimkt_backend/sql/neon_schema.sql
```

The schema creates:

- `users`
- `refresh_tokens`
- `categories`
- `products`
- `product_images`
- `orders`
- `order_items`
- `payments`
- `payment_logs`
- `payment_transaction_seq`

More details are in:

```text
minimkt_backend/NEON_DEPLOY.md
```

## Backend Environment

Create `minimkt_backend/.env` using `minimkt_backend/.env.example` as a template.

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require
DB_SSL=true

JWT_SECRET=replace-with-a-strong-secret
JWT_REFRESH_SECRET=replace-with-a-different-strong-secret

FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3001

ENABLE_CRON=true
PORT=3000
```

Do not commit real secrets or database credentials.

## Frontend Environment

Create `minimkt-front/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

For production, replace it with the deployed backend URL.

## Running Locally

Install backend dependencies:

```powershell
cd minimkt_backend
npm install
```

Start backend:

```powershell
node server.js
```

Install frontend dependencies:

```powershell
cd ..\minimkt-front
npm install
```

Start frontend:

```powershell
npm.cmd run dev
```

Frontend runs at:

```text
http://localhost:3001
```

Backend runs at:

```text
http://localhost:3000
```

The frontend dev script uses Webpack instead of Turbopack for better compatibility on Windows machines where Turbopack may fail with permission errors.

## First Seller Account

Public registration creates users with the `buyer` role.

To access the seller dashboard:

1. Register normally in the app.
2. In Neon SQL Editor, promote the account:

```sql
UPDATE users
SET role = 'seller'
WHERE email = 'seller@example.com';
```

Use `admin` only if the account should manage all sellers' products.

## Deployment

Recommended setup:

```text
Neon     -> PostgreSQL database
Render   -> Express backend
Vercel   -> Next.js frontend
```

### Deploy Backend on Render

Create a Render Web Service:

- Root Directory: `minimkt_backend`
- Build Command:

```bash
npm install
```

- Start Command:

```bash
node server.js
```

Environment variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require
DB_SSL=true
JWT_SECRET=replace-with-a-strong-secret
JWT_REFRESH_SECRET=replace-with-a-different-strong-secret
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-backend.onrender.com
CORS_ORIGINS=https://your-frontend.vercel.app
ENABLE_CRON=true
```

After deploy, test:

```text
https://your-backend.onrender.com/products
```

An empty array `[]` means the API is connected and working.

### Deploy Frontend on Vercel

Create a Vercel project:

- Framework: Next.js
- Root Directory: `minimkt-front`
- Build Command:

```bash
npm run build
```

Environment variable:

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

After Vercel creates the final frontend URL, update the backend variables:

```env
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app
```

Then redeploy the backend.

## Important Notes

- Local uploads are stored in `minimkt_backend/uploads`. On free Render instances, filesystem persistence is limited; for production, use Cloudinary, S3, or another external storage service.
- Render free services may sleep, so the first request can be slow.
- Never expose `DATABASE_URL`, `JWT_SECRET`, or Neon credentials in the frontend.
- If CORS fails in production, make sure `CORS_ORIGINS` exactly matches the Vercel URL.

## Useful Commands

Frontend lint:

```powershell
cd minimkt-front
npm.cmd run lint
```

Backend syntax check:

```powershell
cd minimkt_backend
node --check server.js
```

## License

This project is for study and portfolio/demo purposes.
