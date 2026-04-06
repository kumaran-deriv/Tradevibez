# Deriv API V2 — Complete Reference

## Base URLs

| Type | URL |
|------|-----|
| REST API | `https://api.derivws.com` |
| WebSocket (Public) | `wss://api.derivws.com/trading/v1/options/ws/public` |
| WebSocket (Demo) | `wss://api.derivws.com/trading/v1/options/ws/demo?otp=YOUR_OTP` |
| WebSocket (Real) | `wss://api.derivws.com/trading/v1/options/ws/real?otp=YOUR_OTP` |
| OAuth Authorization | `https://auth.deriv.com/oauth2/auth` |
| OAuth Token Exchange | `https://auth.deriv.com/oauth2/token` |

## App ID

- Default test: `1089`
- Header: `Deriv-App-ID: YOUR_APP_ID`

## Rate Limits

- WebSocket: 100 requests/second per connection
- REST: 60 requests/minute per token
- Active subscriptions: 100 per connection
- Concurrent connections: 5 per user

---

## Authentication — OAuth 2.0 + PKCE

### Flow

1. **Generate PKCE params** (client-side):
   - `code_verifier`: 43-128 char random string
   - `code_challenge`: SHA-256 hash of verifier, base64url encoded
   - `state`: random CSRF token
   - Store `code_verifier` and `state` in `sessionStorage`

2. **Redirect to authorization**:
   ```
   https://auth.deriv.com/oauth2/auth?
     response_type=code
     &client_id=YOUR_APP_ID
     &redirect_uri=YOUR_REDIRECT_URI
     &scope=trade account_manage
     &state=RANDOM_STATE
     &code_challenge=CHALLENGE
     &code_challenge_method=S256
   ```

3. **Handle callback**: Deriv redirects to `redirect_uri` with `code` and `state`

4. **Exchange code for token** (backend only):
   ```
   POST https://auth.deriv.com/oauth2/token
   ```
   Returns:
   ```json
   {
     "access_token": "ory_at_...",
     "expires_in": 3600,
     "token_type": "Bearer"
   }
   ```

5. **Use token**: `Authorization: Bearer YOUR_ACCESS_TOKEN`

### Security Rules
- Verify `state` matches on callback
- Exchange codes immediately (single-use, quick expiry)
- Never exchange tokens from browser — backend only
- Clear verifier after successful exchange
- No refresh token mechanism documented

---

## REST Endpoints (6)

### GET /trading/v1/options/accounts
Get all Options trading accounts.
- **Auth**: Required (Bearer token + App-ID)
- **Response**:
  ```json
  {
    "data": [{
      "account_id": "DOT90004580",
      "balance": 10000,
      "currency": "USD",
      "group": "row",
      "status": "active",
      "account_type": "demo"
    }]
  }
  ```

### POST /trading/v1/options/accounts
Create new Options trading account (demo/real).
- **Auth**: Required

### POST /trading/v1/options/accounts/{account_id}/reset-demo-balance
Reset demo account balance.
- **Auth**: Required

### POST /trading/v1/options/accounts/{accountId}/otp
Generate OTP for WebSocket authentication.
- **Auth**: Required (Bearer token + App-ID)
- **Response**: Contains `data.url` — ready-to-use WebSocket URL with embedded OTP
- **Example**:
  ```javascript
  const response = await fetch(
    'https://api.derivws.com/trading/v1/options/accounts/DOT90004580/otp',
    {
      method: 'POST',
      headers: {
        'Deriv-App-ID': 'YOUR_APP_ID',
        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
      },
    }
  );
  const { data } = await response.json();
  const ws = new WebSocket(data.url); // URL includes OTP
  ```
- **Status codes**: 200 OK, 400 Invalid account, 401 Invalid token, 500 Failed

### GET /trading/v1/options/ws/public
Public WebSocket (no auth).

### GET /v1/health
Service health check.

---

## WebSocket Endpoints (22)

### General Notes
- All messages are JSON
- Use `req_id` field to correlate responses with requests
- Subscriptions via `subscribe: 1` parameter
- Unsubscribe with `forget` or `forget_all`
- Keep alive with periodic `ping`

---

### Market Data (No Auth Required)

#### active_symbols
Get all available trading symbols.
```json
// Request
{ "active_symbols": "brief" }

// Response
{
  "active_symbols": [{
    "exchange_is_open": 1,
    "is_trading_suspended": 0,
    "market": "synthetic_index",
    "pip_size": 0.01,
    "subgroup": "synthetics",
    "submarket": "random_index",
    "underlying_symbol": "1HZ100V",
    "underlying_symbol_name": "Volatility 100 Index",
    "underlying_symbol_type": "stockindex"
  }],
  "msg_type": "active_symbols"
}
```

#### ticks
Real-time price stream.
```json
// Request
{ "ticks": "R_50", "subscribe": 1 }

// Response (streamed)
{
  "tick": {
    "ask": 123.45,
    "bid": 123.44,
    "epoch": 1234567890,
    "id": "xyz123",
    "quote": 123.445,
    "symbol": "R_50"
  },
  "msg_type": "tick",
  "subscription": { "id": "xyz123" }
}
```

#### ticks_history
Historical tick/candle data.
```json
// Request
{
  "ticks_history": "R_50",
  "adjust_start_time": 1,
  "count": 10,
  "end": "latest",
  "start": 1,
  "style": "ticks"
}

// Response
{
  "history": {
    "prices": [123.45, 123.46],
    "times": [1234567890, 1234567891]
  },
  "msg_type": "history"
}
```

#### contracts_for
Available contract types for a symbol.
```json
// Request
{ "contracts_for": "R_50" }

// Response
{
  "contracts_for": {
    "available": [...],
    "spot": 123.45,
    "open": 1234567890,
    "close": 1234567890,
    "hit_count": 30
  },
  "msg_type": "contracts_for"
}
```

#### contracts_list
All contract categories and types.
```json
{ "contracts_list": 1 }
```

---

### Trading Operations (Auth Required)

#### proposal
Get price quote before purchase.
```json
// Request
{
  "proposal": 1,
  "amount": 100,
  "basis": "payout",
  "contract_type": "HIGHER",
  "currency": "USD",
  "duration": 60,
  "duration_unit": "s",
  "underlying_symbol": "R_100",
  "barrier": "+0.1"
}

// Response
{
  "proposal": {
    "ask_price": 51.02,
    "payout": 100,
    "id": "uw2mk7no3oktoRVVsB4Dz7TQnFfABuFDgO95dlxfMxRuPUsz",
    "spot": 123.45,
    "longcode": "Win payout if Volatility 100 Index...",
    "date_start": 1234567890,
    "display_value": "51.02"
  },
  "msg_type": "proposal"
}
```

**Contract Types**: CALL, PUT, HIGHER, LOWER, DIGITEVEN, DIGITODD, DIGITMATCH, DIGITDIFF, ONETOUCH, NOTOUCH, MULTUP, MULTDOWN, ACCU
**Duration Units**: s (seconds), m (minutes), h (hours), d (days), t (ticks)
**Basis**: "stake" or "payout"

#### buy
Purchase contract using proposal ID.
```json
// Request
{
  "buy": "uw2mk7no3oktoRVVsB4Dz7TQnFfABuFDgO95dlxfMxRuPUsz",
  "price": 100
}

// Response
{
  "buy": {
    "balance_after": 9900.00,
    "buy_price": 51.02,
    "contract_id": 11542203588,
    "longcode": "Win payout if Volatility 100 Index...",
    "payout": 100,
    "purchase_time": 1234567890,
    "shortcode": "CALL_R_100_100_1234567890_1234567950_S0P_0",
    "start_time": 1234567890,
    "transaction_id": 12345678
  },
  "msg_type": "buy"
}
```

#### sell
Sell open contract before expiry.
```json
// Request
{ "sell": 11542203588, "price": 500 }

// Response
{
  "sell": {
    "balance_after": 10500.00,
    "contract_id": 11542203588,
    "reference_id": 12345679,
    "sold_for": 50.00,
    "transaction_id": 12345679
  },
  "msg_type": "sell"
}
```

#### proposal_open_contract
Get live status of open contract (supports subscription).
```json
// Request
{
  "proposal_open_contract": 1,
  "contract_id": 11111111,
  "subscribe": 1
}
```
Response includes: contract details, profit/loss, current/entry spot, barrier, buy/bid price, payout, expiry, validity flags (is_expired, is_sold, is_valid_to_sell).

#### contract_update
Modify stop loss / take profit.
```json
{
  "contract_update": 1,
  "contract_id": 11111111,
  "limit_order": {
    "stop_loss": 5,
    "take_profit": 10
  }
}
```

#### contract_update_history
Historical updates for a contract.

#### cancel
Cancel contract if available.

---

### Account Management (Auth Required)

#### balance
Account balance with real-time subscription.
```json
// Request
{ "balance": 1, "subscribe": 1, "req_id": 3 }

// Response
{
  "balance": {
    "balance": 10092.59,
    "currency": "USD",
    "id": "5b1f28c2-003d-0044-cc08-8b4d0a7df538",
    "loginid": "VRTC965733"
  },
  "msg_type": "balance",
  "req_id": 3
}
```

#### portfolio
All open positions.
```json
// Request
{ "portfolio": 1, "req_id": 4 }

// Response
{
  "portfolio": { "contracts": [...] },
  "msg_type": "portfolio",
  "req_id": 4
}
```

#### profit_table
Completed trades summary with pagination.
```json
// Request
{
  "profit_table": 1,
  "description": 1,
  "limit": 25,
  "offset": 0,
  "sort": "DESC"
}

// Response
{
  "profit_table": {
    "count": 100,
    "transactions": [...]
  },
  "msg_type": "profit_table"
}
```

#### statement
Account transaction history.

#### transaction
Real-time transaction notifications (subscription).

---

### Subscription Management

#### forget
Unsubscribe from specific subscription.
```json
{ "forget": "subscription_id" }
```

#### forget_all
Cancel all subscriptions of given type(s).
```json
{ "forget_all": ["ticks", "proposal"] }
```

---

### System

#### ping
```json
{ "ping": 1 }
// Response: { "pong": 1, "msg_type": "ping" }
```

#### time
```json
{ "time": 1 }
// Response: { "time": 1234567890, "msg_type": "time" }
```

#### trading_times
Market hours for all symbols on a date.
```json
{ "trading_times": "2026-04-06" }
```

---

## Error Handling

Common error codes:
- `AuthorizationRequired` — Need authenticated session
- `InvalidToken` — Token expired or invalid
- `RateLimit` — Too many requests
- `InputValidationFailed` — Bad request parameters
- `ContractNotFound` — Invalid contract ID
- `InsufficientBalance` — Not enough funds
- `Unauthorized` — Permission denied

Error response format:
```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Human readable message"
  },
  "msg_type": "error_type"
}
```

---

## Key Notes

- Users get a default demo account on signup — no need to create one via API
- OTP tokens are short-lived — use immediately after generation
- Public WebSocket needs no auth — good for market data before login
- Candle granularity options: 60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400 seconds
