# Authentication

{{API_NAME}} uses API keys for authentication. Include your API key in the `Authorization` header of all requests.

## Getting an API Key

1. Sign up at [{{BASE_URL}}/signup]({{BASE_URL}}/signup)
2. Navigate to your account settings
3. Generate a new API key
4. Store the key securely (it will only be shown once)

## Authentication Methods

### API Key Authentication

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  {{BASE_URL}}/api/{{API_VERSION}}/endpoint
```

**Header Format:**

```
Authorization: Bearer YOUR_API_KEY
```

### Request Example

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/users" \
  -H "Authorization: Bearer sk_live_abc123xyz789" \
  -H "Content-Type: application/json"
```

## API Key Types

### Test Keys

- **Prefix:** `sk_test_`
- **Environment:** Development/Testing
- **Rate Limit:** 100 requests/minute
- **Data:** Sandbox data only

**Example:**
```
sk_test_1234567890abcdef
```

### Live Keys

- **Prefix:** `sk_live_`
- **Environment:** Production
- **Rate Limit:** {{RATE_LIMIT}} requests/minute
- **Data:** Real production data

**Example:**
```
sk_live_1234567890abcdef
```

## Security Best Practices

### Do

- Store API keys in environment variables
- Use different keys for different environments
- Rotate keys regularly (quarterly recommended)
- Revoke compromised keys immediately
- Use test keys for development
- Monitor API key usage

### Don't

- Commit API keys to version control
- Share API keys via email or chat
- Expose keys in client-side code
- Use production keys in development
- Hard-code keys in your application

## Authentication Errors

### 401 Unauthorized

Missing or invalid API key.

**Response:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key",
    "details": {
      "header": "Authorization header is required"
    }
  }
}
```

**Solutions:**

- Verify the API key is correct
- Check the `Authorization` header format
- Ensure the key hasn't been revoked
- Verify you're using the correct environment key

### 403 Forbidden

Valid API key but insufficient permissions.

**Response:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this resource",
    "details": {
      "required_scope": "users:write",
      "current_scopes": ["users:read"]
    }
  }
}
```

## API Key Scopes

API keys can have different scopes to limit access:

| Scope | Description |
|-------|-------------|
| `users:read` | Read user data |
| `users:write` | Create and update users |
| `users:delete` | Delete users |
| `data:read` | Read resource data |
| `data:write` | Create and update data |
| `data:delete` | Delete data |
| `admin:*` | Full administrative access |

## Managing API Keys

### Create a New Key

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/keys" \
  -H "Authorization: Bearer MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "scopes": ["users:read", "data:read"],
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

### List Your Keys

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/keys" \
  -H "Authorization: Bearer MASTER_KEY"
```

### Revoke a Key

```bash
curl -X DELETE "{{BASE_URL}}/api/{{API_VERSION}}/keys/KEY_ID" \
  -H "Authorization: Bearer MASTER_KEY"
```

### Rotate a Key

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/keys/KEY_ID/rotate" \
  -H "Authorization: Bearer MASTER_KEY"
```

## Rate Limiting

Authenticated requests are subject to rate limiting based on your plan:

- **Free Plan:** 100 requests/minute
- **Pro Plan:** 1,000 requests/minute
- **Enterprise Plan:** {{RATE_LIMIT}} requests/minute

See [Rate Limiting](#rate-limiting) for more details.

## IP Whitelisting

For additional security, you can whitelist IP addresses:

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/keys/KEY_ID/whitelist" \
  -H "Authorization: Bearer MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ip_addresses": ["203.0.113.0", "198.51.100.0/24"]
  }'
```

## Webhook Signatures

For webhooks, verify the signature using your webhook secret:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
```

## OAuth 2.0 (Coming Soon)

OAuth 2.0 authentication will be available in a future release.

## Support

For authentication issues, contact {{CONTACT_EMAIL}}
