# Flutterwave M-Pesa Integration Setup

## Environment Variables

Add the following to your `.env` file in the root directory:

```env
# Flutterwave Configuration
FLUTTERWAVE_SECRET_KEY=<REPLACE_WITH_FLUTTERWAVE_SECRET_KEY>
FLUTTERWAVE_PUBLIC_KEY=<REPLACE_WITH_FLUTTERWAVE_PUBLIC_KEY>

# Optional: Flutterwave Webhook Secret (for webhook verification)
FLUTTERWAVE_WEBHOOK_SECRET=your_webhook_secret_here
```

## Getting Your Flutterwave API Keys

1. **Sign up/Login** to Flutterwave Dashboard: https://dashboard.flutterwave.com
2. Navigate to **Settings** → **API Keys**
3. Copy your **Secret Key** (starts with `FLWSECK_TEST_` for test mode or `FLWSECK_` for live mode)
4. Copy your **Public Key** (starts with `FLWPUBK_TEST_` for test mode or `FLWPUBK_` for live mode)

## Test Mode vs Live Mode

- **Test Mode**: Use test keys for development. Test phone numbers: `254708374149`
- **Live Mode**: Use live keys for production. Requires account verification.

## Webhook Configuration

1. In Flutterwave Dashboard, go to **Settings** → **Webhooks**
2. Add webhook URL: `https://your-domain.com/api/payments/mpesa/webhook`
3. Select events: `charge.completed`, `charge.failed`
4. Copy the webhook secret and add it to `.env`

## Testing M-Pesa Payments

### Test Phone Numbers (Test Mode Only)
- **Success**: `254708374149`
- **Failure**: `254708374150`

### Payment Flow
1. User initiates payment from frontend
2. Backend calls Flutterwave API to initiate STK push
3. User receives prompt on their phone
4. User enters M-Pesa PIN
5. Flutterwave sends webhook to your backend
6. Backend updates payment status in database

## API Endpoints

### Initiate STK Push
```
POST /api/payments/mpesa/stk-push
Body: {
  "bookingId": 1,
  "phone": "+254712345678",
  "email": "user@example.com", // optional
  "name": "John Doe" // optional
}
```

### Verify Payment
```
GET /api/payments/mpesa/verify/:paymentId
```

### Webhook (Flutterwave calls this)
```
POST /api/payments/mpesa/webhook
```

## Phone Number Format

The service accepts phone numbers in these formats:
- `+254712345678` (international format)
- `0712345678` (local format with leading 0)
- `254712345678` (without +)

All formats are automatically converted to `254712345678` for Flutterwave.

## Error Handling

The integration handles:
- Invalid phone numbers
- Network errors
- Flutterwave API errors
- Payment verification failures

All errors are logged and returned with appropriate HTTP status codes.
