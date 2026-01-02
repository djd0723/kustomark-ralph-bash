# {{api_name}} API Reference

Complete API reference for {{api_name}} {{api_version}}.

## Base URL

```
{{base_url}}
```

## Authentication

All API requests require authentication using an API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" {{base_url}}/endpoint
```

## Endpoints

### GET /health

Check API health status.

**Response:**

```json
{
  "status": "healthy",
  "version": "{{api_version}}"
}
```

### GET /users

Retrieve list of users.

**Response:**

```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe"
    }
  ]
}
```

## Rate Limits

- 1000 requests per hour per API key
- 10000 requests per day per API key

## Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad Request |
| 401  | Unauthorized |
| 404  | Not Found |
| 429  | Rate Limit Exceeded |
| 500  | Internal Server Error |
