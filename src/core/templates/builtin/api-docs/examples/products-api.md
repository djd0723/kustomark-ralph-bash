# Products API

Manage products and inventory.

## List Products

Get a paginated list of products.

### Request

**Method:** `GET`

**Endpoint:** `/api/{{API_VERSION}}/products`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 10 | Maximum number of results (1-100) |
| `offset` | integer | No | 0 | Pagination offset |
| `category` | string | No | - | Filter by category |
| `min_price` | number | No | - | Minimum price filter |
| `max_price` | number | No | - | Maximum price filter |
| `in_stock` | boolean | No | - | Filter by stock availability |
| `sort` | string | No | `created_at` | Sort field |
| `order` | string | No | `desc` | Sort order (`asc` or `desc`) |

### Response

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "prd_123",
      "name": "Premium Widget",
      "description": "High-quality widget for all your needs",
      "category": "widgets",
      "price": 99.99,
      "currency": "USD",
      "stock": 150,
      "sku": "WDG-001",
      "images": [
        "https://cdn.example.com/images/widget1.jpg"
      ],
      "created_at": "2024-03-01T10:00:00Z",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Examples

**List all products:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/products" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Filter by category and price:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/products?category=widgets&min_price=50&max_price=150&in_stock=true" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Get Product

Get a specific product by ID.

### Request

**Method:** `GET`

**Endpoint:** `/api/{{API_VERSION}}/products/:id`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Product ID (format: `prd_*`) |

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "prd_123",
    "name": "Premium Widget",
    "description": "High-quality widget for all your needs",
    "category": "widgets",
    "price": 99.99,
    "currency": "USD",
    "stock": 150,
    "sku": "WDG-001",
    "images": [
      "https://cdn.example.com/images/widget1.jpg",
      "https://cdn.example.com/images/widget2.jpg"
    ],
    "attributes": {
      "color": "blue",
      "size": "large",
      "weight": "2.5kg"
    },
    "created_at": "2024-03-01T10:00:00Z",
    "updated_at": "2024-03-15T10:00:00Z"
  }
}
```

### Examples

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/products/prd_123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Create Product

Create a new product.

### Request

**Method:** `POST`

**Endpoint:** `/api/{{API_VERSION}}/products`

**Authentication:** Required (scope: `products:write`)

**Request Body:**

```json
{
  "name": "Super Widget",
  "description": "The best widget on the market",
  "category": "widgets",
  "price": 149.99,
  "currency": "USD",
  "stock": 100,
  "sku": "WDG-002",
  "images": [
    "https://cdn.example.com/images/super-widget.jpg"
  ],
  "attributes": {
    "color": "red",
    "size": "medium"
  }
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name (3-200 characters) |
| `description` | string | No | Product description |
| `category` | string | Yes | Product category |
| `price` | number | Yes | Price (positive number) |
| `currency` | string | No | Currency code (default: `USD`) |
| `stock` | integer | Yes | Stock quantity (non-negative) |
| `sku` | string | Yes | SKU (unique) |
| `images` | array | No | Image URLs |
| `attributes` | object | No | Custom product attributes |

### Response

**Success Response (201 Created):**

```json
{
  "data": {
    "id": "prd_124",
    "name": "Super Widget",
    "description": "The best widget on the market",
    "category": "widgets",
    "price": 149.99,
    "currency": "USD",
    "stock": 100,
    "sku": "WDG-002",
    "created_at": "2024-03-15T10:05:00Z"
  }
}
```

### Examples

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/products" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Widget",
    "description": "The best widget on the market",
    "category": "widgets",
    "price": 149.99,
    "stock": 100,
    "sku": "WDG-002"
  }'
```

## Update Product

Update an existing product.

### Request

**Method:** `PUT`

**Endpoint:** `/api/{{API_VERSION}}/products/:id`

**Authentication:** Required (scope: `products:write`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Product ID |

**Request Body:**

```json
{
  "name": "Super Widget Pro",
  "price": 179.99,
  "stock": 75
}
```

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "prd_124",
    "name": "Super Widget Pro",
    "price": 179.99,
    "stock": 75,
    "updated_at": "2024-03-15T10:10:00Z"
  }
}
```

### Examples

```bash
curl -X PUT "{{BASE_URL}}/api/{{API_VERSION}}/products/prd_124" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Widget Pro",
    "price": 179.99
  }'
```

## Delete Product

Delete a product.

### Request

**Method:** `DELETE`

**Endpoint:** `/api/{{API_VERSION}}/products/:id`

**Authentication:** Required (scope: `products:delete`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Product ID |

### Response

**Success Response (204 No Content)**

No response body.

### Examples

```bash
curl -X DELETE "{{BASE_URL}}/api/{{API_VERSION}}/products/prd_124" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Update Stock

Update product stock quantity.

### Request

**Method:** `PATCH`

**Endpoint:** `/api/{{API_VERSION}}/products/:id/stock`

**Authentication:** Required (scope: `products:write`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Product ID |

**Request Body:**

```json
{
  "quantity": 200,
  "operation": "set"
}
```

**Operations:**
- `set` - Set stock to exact quantity
- `add` - Add to current stock
- `subtract` - Subtract from current stock

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "prd_123",
    "stock": 200,
    "updated_at": "2024-03-15T10:15:00Z"
  }
}
```

### Examples

**Set stock to 200:**

```bash
curl -X PATCH "{{BASE_URL}}/api/{{API_VERSION}}/products/prd_123/stock" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 200,
    "operation": "set"
  }'
```

**Add 50 to stock:**

```bash
curl -X PATCH "{{BASE_URL}}/api/{{API_VERSION}}/products/prd_123/stock" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50,
    "operation": "add"
  }'
```

## Search Products

Search products by name or description.

### Request

**Method:** `GET`

**Endpoint:** `/api/{{API_VERSION}}/products/search`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 3 characters) |
| `limit` | integer | No | Maximum results (default: 10) |
| `offset` | integer | No | Pagination offset |

### Response

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "prd_123",
      "name": "Premium Widget",
      "description": "High-quality widget",
      "price": 99.99,
      "relevance_score": 0.95
    }
  ],
  "query": "widget",
  "total": 15
}
```

### Examples

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/products/search?q=widget&limit=5" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Common Errors

### SKU Already Exists

```json
{
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "Product with this SKU already exists",
    "details": {
      "field": "sku",
      "value": "WDG-002"
    }
  }
}
```

### Insufficient Stock

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for this operation",
    "details": {
      "available": 10,
      "requested": 50
    }
  }
}
```

### Invalid Price

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Price must be a positive number",
    "details": {
      "field": "price",
      "value": -10
    }
  }
}
```

## Related Endpoints

- [Authentication](./authentication.md)
- [Users API](./users-api.md)
