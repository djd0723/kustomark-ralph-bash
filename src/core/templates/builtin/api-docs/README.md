# API Documentation Template

This template helps you generate consistent, professional API documentation from templates and examples.

## Use Case

Perfect for scenarios where you need to:
- Create standardized REST API documentation
- Document multiple API endpoints consistently
- Generate API docs from templates
- Maintain API documentation across versions
- Ensure consistent formatting and structure
- Generate documentation for multiple microservices

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Templates      │     │                 │     │  Generated      │
│  - Endpoint     │     │                 │     │  API Docs       │
│  - Auth         │ ──▶ │  Kustomark      │ ──▶ │                 │
│  - Errors       │     │  Processing     │     │  - Consistent   │
└─────────────────┘     │                 │     │  - Formatted    │
┌─────────────────┐     │                 │     │  - Complete     │
│  Examples       │ ──▶ │                 │     └─────────────────┘
│  - Users API    │     └─────────────────┘
│  - Products API │
└─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `API_NAME` | string | Yes | - | Name of the API |
| `API_VERSION` | string | Yes | - | API version number |
| `BASE_URL` | string | Yes | - | Base URL for the API |
| `CONTACT_EMAIL` | string | Yes | - | Contact email for API support |
| `RATE_LIMIT` | string | Yes | `1000` | Rate limit (requests per minute) |

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template api-docs
```

You'll be prompted for:
1. API name (e.g., `MyAPI`)
2. API version (e.g., `v1`)
3. Base URL (e.g., `https://api.example.com`)
4. Contact email (e.g., `api-support@example.com`)
5. Rate limit (default: `1000`)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template api-docs \
  --var API_NAME=MyAPI \
  --var API_VERSION=v1 \
  --var BASE_URL=https://api.example.com \
  --var CONTACT_EMAIL=api-support@example.com \
  --var RATE_LIMIT=1000
```

## What Gets Created

After initialization, you'll have:

1. **kustomark.yaml** - Configuration file with:
   - Resource references to templates and examples
   - Patch operations for consistent formatting
   - Frontmatter standardization
   - URL and version replacement

2. **README.md** - This documentation file

3. **templates/** directory with:
   - `endpoint-template.md` - Template for documenting new endpoints
   - `authentication.md` - Authentication documentation
   - `errors.md` - Error handling documentation

4. **examples/** directory with:
   - `users-api.md` - Example Users API documentation
   - `products-api.md` - Example Products API documentation

## Directory Structure

```
.
├── kustomark.yaml              # Main configuration
├── README.md                   # This file
├── templates/                  # Documentation templates
│   ├── endpoint-template.md    # Template for new endpoints
│   ├── authentication.md       # Auth documentation
│   └── errors.md              # Error handling docs
├── examples/                   # Example API docs
│   ├── users-api.md           # Users API example
│   └── products-api.md        # Products API example
└── output/                     # Generated documentation
    ├── authentication.md
    ├── errors.md
    ├── users-api.md
    └── products-api.md
```

## Documenting a New Endpoint

### 1. Copy the Template

```bash
cp templates/endpoint-template.md examples/orders-api.md
```

### 2. Fill in Endpoint Details

Edit `examples/orders-api.md`:

```markdown
# Orders API

Manage customer orders.

## Create Order

Create a new order.

### Request

**Method:** `POST`

**Endpoint:** `/api/v1/orders`

**Authentication:** Required

**Request Body:**

```json
{
  "customer_id": "usr_123",
  "items": [
    {
      "product_id": "prd_456",
      "quantity": 2
    }
  ]
}
```
...
```

### 3. Add to Resources

Update `kustomark.yaml`:

```yaml
resources:
  - templates/authentication.md
  - templates/errors.md
  - examples/users-api.md
  - examples/products-api.md
  - examples/orders-api.md  # Add new file
```

### 4. Build Documentation

```bash
kustomark build
```

## Customizing Templates

### Authentication Template

Edit `templates/authentication.md` to match your auth system:

```markdown
## API Key Authentication

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  {{BASE_URL}}/api/{{API_VERSION}}/endpoint
```
```

### Error Template

Customize error codes and formats in `templates/errors.md`:

```markdown
## Error Codes

### CUSTOM_ERROR

Description of your custom error.

```json
{
  "error": {
    "code": "CUSTOM_ERROR",
    "message": "Custom error message"
  }
}
```
```

## Advanced Customization

### Adding OpenAPI Integration

Generate docs from OpenAPI spec:

```yaml
# kustomark.yaml
resources:
  # Import from OpenAPI spec
  - openapi.yaml

patches:
  # Convert OpenAPI to markdown
  - op: transform
    from: openapi
    to: markdown
```

### Multiple API Versions

Document multiple versions:

```
examples/
├── v1/
│   ├── users-api.md
│   └── products-api.md
└── v2/
    ├── users-api.md
    └── products-api.md
```

Update patches per version:

```yaml
patches:
  - op: replace
    old: "{{API_VERSION}}"
    new: "v1"
    include: "**/v1/*.md"

  - op: replace
    old: "{{API_VERSION}}"
    new: "v2"
    include: "**/v2/*.md"
```

### Custom Formatting

Add custom formatting rules:

```yaml
patches:
  # Standardize HTTP methods
  - op: replace-regex
    pattern: '\*\*(GET|POST|PUT|DELETE|PATCH)\*\*'
    replacement: '`$1`'
    flags: g

  # Format response codes
  - op: replace-regex
    pattern: '(\d{3})\s+(OK|Created|Not Found)'
    replacement: '**$1 $2**'
    flags: g

  # Add syntax highlighting hints
  - op: replace-regex
    pattern: '```json\n'
    replacement: '```json\n// Response example\n'
    flags: g
```

### Adding Code Examples

Add multi-language examples:

```yaml
patches:
  - op: append-to-section
    id: examples
    content: |

      #### JavaScript Example

      ```javascript
      const response = await fetch('{{BASE_URL}}/api/{{API_VERSION}}/users', {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      });
      const data = await response.json();
      ```

      #### Python Example

      ```python
      import requests

      response = requests.get(
          '{{BASE_URL}}/api/{{API_VERSION}}/users',
          headers={'Authorization': f'Bearer {API_KEY}'}
      )
      data = response.json()
      ```
```

## Building Documentation

### Build All Docs

```bash
kustomark build
```

Output will be in `./output/`

### Build Specific Version

```bash
kustomark build --var API_VERSION=v2
```

### Watch Mode

Auto-rebuild on changes:

```bash
kustomark watch
```

### Preview Changes

See what will be generated:

```bash
kustomark diff
```

## Publishing Documentation

### Static Site Generation

Convert to static site:

```bash
# Using Docsify
kustomark build
npx docsify-cli init ./output
npx docsify-cli serve ./output

# Using MkDocs
kustomark build
cd output
mkdocs serve

# Using Docusaurus
kustomark build
npx @docusaurus/init@latest init docs classic
```

### Deploy to GitHub Pages

```yaml
# .github/workflows/docs.yml
name: Deploy Docs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build API docs
        run: kustomark build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./output
```

### Deploy to Netlify

```toml
# netlify.toml
[build]
  command = "kustomark build"
  publish = "output"
```

## Best Practices

### 1. Use Consistent Structure

Follow the template structure for all endpoints:

- Request section with method, endpoint, auth
- Parameters tables
- Request body with schema
- Response examples
- Error codes
- Examples section

### 2. Include Examples

Provide real, working examples:

```bash
# Good - complete example
curl -X GET "https://api.example.com/v1/users/123" \
  -H "Authorization: Bearer sk_test_abc123"

# Bad - incomplete
curl /users/123
```

### 3. Document Error Cases

Include common error scenarios:

```markdown
## Common Errors

### User Not Found

When the user ID doesn't exist:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```
```

### 4. Keep Examples Up to Date

Use variables for values that change:

```markdown
- Base URL: `{{BASE_URL}}`
- Version: `{{API_VERSION}}`
- Rate Limit: `{{RATE_LIMIT}}`
```

### 5. Link Related Docs

Cross-reference related endpoints:

```markdown
## Related Endpoints

- [Get User](./users-api.md#get-user)
- [List Orders](./orders-api.md#list-orders)
```

## Testing Documentation

### Validate Generated Docs

```bash
# Check for broken links
kustomark validate --check-links

# Validate against OpenAPI spec
kustomark validate --spec openapi.yaml

# Run custom validators
kustomark validate --custom validators.js
```

### Test API Examples

Extract and test curl examples:

```bash
# Extract curl commands
grep -A5 "```bash" output/*.md | grep "curl" > test-requests.sh

# Test them
bash test-requests.sh
```

## Troubleshooting

### Variables Not Replaced

Ensure variables match exactly:

```yaml
# Template uses {{BASE_URL}}
# Patch must use same format
- op: replace
  old: "{{BASE_URL}}"
  new: "https://api.example.com"
```

### Formatting Issues

Check regex patterns:

```yaml
# Test patterns with verbose mode
kustomark build -vv
```

### Missing Sections

Verify section IDs:

```markdown
## Examples {#examples}
<!-- Section ID must match patch -->
```

## Examples

See the `examples/` directory for complete working examples:

- **users-api.md** - Full CRUD API documentation
- **products-api.md** - E-commerce API documentation

Build the examples:

```bash
kustomark build
ls -la output/
```

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [REST API Best Practices](https://restfulapi.net/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [API Documentation Guide](https://swagger.io/blog/api-documentation/)
