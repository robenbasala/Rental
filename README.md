# Kids Birthday Party Rental Platform

Production-ready starter for a modern equipment rental web app with:

- `frontend`: React + Vite + Tailwind CSS
- `backend`: Node.js + Express + SQL Server + Stripe + Google Maps

## Folder Structure

```txt
RentalProject/
  backend/
    src/
      config/
      db/
      middleware/
      routes/
      services/
      utils/
    .env.example
    package.json
  frontend/
    src/
      components/
      pages/
        admin/
    .env.example
    package.json
  README.md
```

## Backend Setup

1. Copy `backend/.env.example` to `backend/.env`
2. Create SQL Server database (`KidsRentalDb`)
3. Run `backend/src/db/schema.sql` in SQL Server
4. Install and start backend:

```bash
cd backend
npm install
npm run dev
```

## Frontend Setup

1. Copy `frontend/.env.example` to `frontend/.env`
2. Install and start frontend:

```bash
cd frontend
npm install
npm run dev
```

## Stripe Integration

- Backend endpoint: `POST /api/payments/create-session`
- Webhook endpoint: `POST /api/payments/webhook`
- Configure webhook in Stripe dashboard:
  - URL: `http://localhost:4000/api/payments/webhook`
  - Event: `checkout.session.completed`
- Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and frontend publishable key env vars.

## Google Maps Distance Integration

- Backend endpoint: `POST /api/delivery/calculate`
- Uses Distance Matrix API from fixed business address:
  - `25 Monroe Ave, Toms River, NJ 08755`
- Delivery fee formula:
  - `deliveryFee = miles * 0.75`
- Max distance controlled in `Settings` table.

## Core API Coverage

Public:

- `GET /api/equipment`
- `GET /api/equipment/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/cart/quote`
- `POST /api/delivery/calculate`
- `POST /api/orders`
- `POST /api/payments/create-session`
- `GET /api/orders/:id`

Customer account:

- `GET /api/me/profile`
- `PUT /api/me/profile`
- `GET /api/me/orders`
- `GET /api/me/invoices`
- `GET /api/me/payment-methods`
- `POST /api/me/payment-methods/setup-intent`
- `DELETE /api/me/payment-methods/:id`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/reorder`

Admin:

- `POST /api/admin/login`
- `GET /api/admin/dashboard`
- CRUD `/api/admin/equipment`
- CRUD `/api/admin/categories`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/status`
- `GET/PUT /api/admin/settings`
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id`
- `POST /api/admin/customers/:id/notes`

## Notes

- Backend calculates all totals (subtotal, delivery, tax, total).
- Frontend does not trust client totals.
- Stripe stores card data securely; DB stores only Stripe IDs/metadata.
- Date-aware overbooking protection is enforced on order creation.
