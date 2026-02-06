# 🔧 Safaricom Daraja Setup Guide

## Overview

HostPulse now uses **direct Safaricom Daraja API integration** for all M-Pesa payments. This guide will help you configure the system for production use.

---

## 📋 Prerequisites

1. **Safaricom Daraja Account**
   - Sign up at: https://developer.safaricom.co.ke
   - Complete business verification
   - Get your API credentials

2. **M-Pesa Business Account**
   - Active M-Pesa Business account
   - Shortcode (PayBill or Till Number)
   - Passkey from Daraja dashboard

---

## 🔑 Required Credentials

### Sandbox (Testing)
Get from: https://developer.safaricom.co.ke/apis

- **Consumer Key** - From Daraja dashboard
- **Consumer Secret** - From Daraja dashboard
- **Shortcode** - Test shortcode (e.g., 174379)
- **Passkey** - Test passkey from dashboard
- **Initiator Name** - Test initiator name
- **Security Credential** - Generated from Daraja dashboard

### Production (Live)
Get from: https://developer.safaricom.co.ke/apis (after approval)

- **Consumer Key** - Production consumer key
- **Consumer Secret** - Production consumer secret
- **Shortcode** - Your business shortcode
- **Passkey** - Production passkey
- **Initiator Name** - Your initiator name
- **Security Credential** - Encrypted credential (use Daraja tool)
- **Certificate** - Download production certificate

---

## ⚙️ Environment Configuration

Add to your `.env` file:

```env
# Daraja Environment
MPESA_ENVIRONMENT=sandbox  # Change to 'production' for live

# Daraja OAuth Credentials
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=<REPLACE_WITH_MPESA_CONSUMER_SECRET>

# STK Push Configuration
MPESA_SHORTCODE=your_shortcode_here
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/webhook

# B2C Payout Configuration
MPESA_INITIATOR_NAME=your_initiator_name
MPESA_SECURITY_CREDENTIAL=your_security_credential
MPESA_QUEUE_TIMEOUT_URL=https://your-domain.com/api/payments/mpesa/b2c-timeout
MPESA_RESULT_URL=https://your-domain.com/api/payments/mpesa/b2c-result

# Production Certificate (production only)
MPESA_CERTIFICATE_PATH=/path/to/production_cert.pem

# API Base URL
API_BASE_URL=https://your-domain.com
```

---

## 🔐 Security Credential Generation

### For Sandbox:
1. Go to Daraja dashboard
2. Navigate to "My Apps" → Your App
3. Copy the Security Credential (plain text)

### For Production:
1. Download the production certificate from Daraja
2. Use Daraja's credential generation tool:
   ```bash
   # Use the online tool at:
   # https://developer.safaricom.co.ke/tools/credential-generator
   ```
3. Enter your Initiator Name and Certificate
4. Copy the generated Security Credential

---

## 🌐 Webhook Configuration

### In Daraja Dashboard:

1. **STK Push Callback URL:**
   ```
   https://your-domain.com/api/payments/mpesa/webhook
   ```

2. **B2C Result URL:**
   ```
   https://your-domain.com/api/payments/mpesa/b2c-result
   ```

3. **B2C Timeout URL:**
   ```
   https://your-domain.com/api/payments/mpesa/b2c-timeout
   ```

### Webhook Requirements:
- Must be HTTPS (production)
- Must be publicly accessible
- Must return 200 OK within 5 seconds
- Should validate webhook signatures (implement in production)

---

## 🧪 Testing in Sandbox

### Test Phone Numbers:
- **Success:** 254708374149
- **Failure:** 254708374150
- **Timeout:** 254708374151

### Test Flow:
1. Use sandbox credentials in `.env`
2. Set `MPESA_ENVIRONMENT=sandbox`
3. Initiate STK Push with test number
4. Use test PIN: **0000**
5. Verify payment in webhook

---

## 🚀 Production Deployment Checklist

- [ ] Business verification completed
- [ ] Production credentials obtained
- [ ] Certificate downloaded and secured
- [ ] Security Credential generated
- [ ] Webhook URLs configured in Daraja
- [ ] HTTPS enabled for webhooks
- [ ] Environment variables set
- [ ] Scheduled jobs configured
- [ ] Monitoring and logging set up
- [ ] Test transaction completed

---

## 📞 Support

- **Daraja Documentation:** https://developer.safaricom.co.ke/docs
- **Daraja Support:** support@developer.safaricom.co.ke
- **Safaricom Business:** Call 100

---

## ⚠️ Important Notes

1. **Never commit credentials to version control**
2. **Use environment variables for all secrets**
3. **Rotate credentials regularly**
4. **Monitor webhook logs for failures**
5. **Implement webhook signature validation**
6. **Set up alerts for failed transactions**

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd")
