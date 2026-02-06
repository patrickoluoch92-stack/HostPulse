# 🔑 How to Get Your Flutterwave API Keys

## Quick Steps

1. **Go to Flutterwave Dashboard**
   - Visit: https://dashboard.flutterwave.com
   - Sign up for a free account (if you don't have one)
   - Or log in if you already have an account

2. **Navigate to API Keys**
   - Click on **Settings** (usually in the left sidebar)
   - Click on **API Keys** or **API & Webhooks**

3. **Copy Your Keys**
   - **Secret Key**: Starts with `FLWSECK_TEST_` (test mode) or `FLWSECK_` (live mode)
   - **Public Key**: Starts with `FLWPUBK_TEST_` (test mode) or `FLWPUBK_` (live mode)

4. **Update Your .env File**
   - Open `.env` in the root directory
   - Replace `your_flutterwave_secret_key_here` with your actual Secret Key
   - Replace `your_flutterwave_public_key_here` with your actual Public Key

## Example .env Configuration

```env
# Flutterwave Payment Gateway Configuration
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-1234567890abcdef1234567890abcdef-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-1234567890abcdef1234567890abcdef-X
```

## Test Mode vs Live Mode

### Test Mode (Development)
- Keys start with `FLWSECK_TEST_` and `FLWPUBK_TEST_`
- Use for development and testing
- Test phone number: `254708374149`
- No real money is charged

### Live Mode (Production)
- Keys start with `FLWSECK_` and `FLWPUBK_`
- Use for real transactions
- Requires account verification
- Real money is processed

## Important Notes

⚠️ **Never commit your .env file to version control!**
- The `.env` file should already be in `.gitignore`
- Keep your secret keys private
- Use test keys for development
- Only use live keys in production

## After Adding Keys

1. **Restart your backend server** for changes to take effect:
   ```powershell
   npx nx serve api.
   ```

2. **Test the integration** by creating a booking and initiating a payment

3. **Check the logs** to see if the Flutterwave API is being called correctly

## Troubleshooting

### "Payment service is not configured"
- Make sure `FLUTTERWAVE_SECRET_KEY` is set in `.env`
- Restart the backend after adding keys
- Check for typos in the key names

### "Invalid API key"
- Verify you copied the entire key (they're long!)
- Make sure there are no extra spaces
- Check if you're using test keys in test mode

### Need Help?
- Flutterwave Support: https://support.flutterwave.com
- Flutterwave Docs: https://developer.flutterwave.com/docs
