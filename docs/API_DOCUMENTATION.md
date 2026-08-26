# VYBECHECK API & Integration Documentation (MVP Specification)

## 1. Overview
Vybecheck connects nightclub and event audiences directly with DJs via QR codes, allowing guests to submit paid song requests, tip via Paystack in Nigerian Naira (₦ NGN), and enabling DJs to execute instant automated payouts into their local Nigerian bank accounts (NUBAN).

---

## 2. Environment Variables Configuration

Set these in your environment or `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Paystack API Keys (Nigerian Payments & Instant Transfers)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# DJ Auth & Webhook Secrets
PAYSTACK_WEBHOOK_SECRET=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=super_secret_session_key_vybecheck
```

---

## 3. Endpoints Reference

### 3.1 Public Song Requests

#### `POST /api/requests`
Submit a new guest song request with optional initial VIP tip.
- **Request Body**:
  ```json
  {
    "song": "Last Last",
    "artist": "Burna Boy",
    "genre": "Afrobeats",
    "requesterName": "Tunde",
    "vipShoutout": "Special birthday shoutout to the VIP table 4!",
    "tipAmount": 25000,
    "djId": "dj_bama_lagos"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "request": {
      "id": "req_1720000000000_abc123",
      "trackingToken": "TRK-CITY-8912",
      "song": "Last Last",
      "artist": "Burna Boy",
      "genre": "Afrobeats",
      "requesterName": "Tunde",
      "vipShoutout": "Special birthday shoutout to the VIP table 4!",
      "status": "pending",
      "priority": true,
      "tipAmount": 25000,
      "createdAt": "2026-08-25T10:00:00.000Z"
    }
  }
  ```

#### `GET /api/requests`
Fetch real-time request queue.
- **Query Params**: `?eventId=evt_matrix_lagos_01` (optional)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "requests": [ ... ]
  }
  ```

---

### 3.2 Paystack Payments (Audience Tipping & Priority Elevation)

#### `POST /api/payments/initialize`
Initializes a Paystack checkout transaction for a song request.
- **Request Body**:
  ```json
  {
    "requestId": "req_1720000000000_abc123",
    "amount": 50000,
    "email": "tunde@example.com",
    "callbackUrl": "https://vybecheckwithbama.live/#customer_tracking"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "authorizationUrl": "https://checkout.paystack.com/39a8xb12984",
    "accessCode": "39a8xb12984",
    "reference": "vybe_req_1720000000000_abc123_1724567890"
  }
  ```

#### `GET /api/payments/verify/:reference`
Verifies a transaction after successful client authorization and elevates the song to VIP priority.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "status": "success",
    "amount": 50000,
    "requestId": "req_1720000000000_abc123",
    "request": {
      "id": "req_1720000000000_abc123",
      "status": "up_next",
      "priority": true,
      "tipAmount": 50000
    }
  }
  ```

#### `POST /api/payments/webhook`
Receives asynchronous webhooks from Paystack with HMAC-SHA512 header verification (`x-paystack-signature`).
- Automatically credits the DJ's `availableBalance` and marks the song request as elevated VIP.

---

### 3.3 Instant DJ Payouts & NUBAN Banking

#### `GET /api/payout/banks`
Returns all Nigerian commercial banks and fintech providers supported by Paystack.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "banks": [
      { "id": 1, "name": "Access Bank", "code": "044" },
      { "id": 2, "name": "Guaranty Trust Bank (GTBank)", "code": "058" },
      { "id": 3, "name": "Zenith Bank", "code": "057" },
      { "id": 4, "name": "Kuda Bank", "code": "50211" },
      { "id": 5, "name": "OPay", "code": "999992" },
      { "id": 6, "name": "PalmPay", "code": "999991" }
    ]
  }
  ```

#### `GET /api/payout/resolve-account?accountNumber=0124892019&bankCode=058`
Validates a Nigerian bank account number with the NIBSS central registry and returns the verified account holder name.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "accountName": "BABATUNDE ADENIYI (DJ BAMA)",
    "accountNumber": "0124892019",
    "bankCode": "058"
  }
  ```

#### `POST /api/payout/withdraw`
Triggers an instant NIBSS automated withdrawal from the DJ's available wallet balance.
- **Request Body**:
  ```json
  {
    "djId": "dj_bama_lagos",
    "amount": 75000,
    "bankDetails": {
      "bankName": "Guaranty Trust Bank (GTBank)",
      "accountNumber": "0124892019",
      "accountName": "Babatunde Adeniyi",
      "bankCode": "058"
    }
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Instant withdrawal of ₦75,000 processed successfully",
    "payout": {
      "id": "payout_1724567890_99182",
      "djId": "dj_bama_lagos",
      "amount": 75000,
      "fee": 25,
      "netAmount": 74975,
      "bankName": "Guaranty Trust Bank (GTBank)",
      "accountNumber": "0124892019",
      "accountName": "Babatunde Adeniyi",
      "reference": "PO-1724567890123-9918",
      "status": "success",
      "createdAt": "2026-08-25T10:30:00.000Z"
    },
    "wallet": {
      "availableBalance": 425000,
      "totalWithdrawn": 75000,
      "totalTipsEarned": 500000
    }
  }
  ```

---

## 4. Database Schema (SQLite / Django ORM Compatible)

- **`djs`**: DJ profiles, credentials, branding, wallet ledger (`availableBalance`, `totalWithdrawn`, `totalTipsEarned`), and Paystack recipient codes.
- **`events`**: Live sessions, venue details, and toggle flags (`requestsEnabled`, `autoPriority`, `tipsEnabled`).
- **`requests`**: Song requests with tracking tokens, VIP status, tip amounts, and status transitions (`pending` -> `up_next` -> `playing` -> `played` / `rejected`).
- **`payouts`**: Immutable transaction log of all withdrawals and bank settlements.
- **`magic_tokens`**: Passwordless magic link tokens for DJ authentication.
