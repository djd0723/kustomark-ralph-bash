# Multi-Environment Template

This template helps you manage documentation for multiple environments (development, staging, production) using a base + overlay pattern.

## Use Case

Perfect for scenarios where you need to:
- Maintain separate documentation for dev, staging, and production environments
- Share common content across environments while customizing environment-specific details
- Deploy environment-specific API documentation
- Manage different configurations per environment
- Keep documentation DRY (Don't Repeat Yourself)

## How It Works

```
┌─────────────────┐
│  Base Docs      │ ─┐
│  (Common)       │  │
└─────────────────┘  │
                     ├──▶ ┌─────────────────┐
┌─────────────────┐  │    │  Dev Docs       │
│  Dev Overlay    │ ─┤    │  (Customized)   │
└─────────────────┘  │    └─────────────────┘
                     │
                     ├──▶ ┌─────────────────┐
┌─────────────────┐  │    │  Staging Docs   │
│  Staging        │ ─┤    │  (Customized)   │
│  Overlay        │  │    └─────────────────┘
└─────────────────┘  │
                     │
                     └──▶ ┌─────────────────┐
┌─────────────────┐       │  Production     │
│  Production     │ ──────│  Docs           │
│  Overlay        │       │  (Customized)   │
└─────────────────┘       └─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PROJECT_NAME` | string | Yes | - | Name of the project or product |
| `BASE_URL_DEV` | string | Yes | `https://dev.example.com` | Base URL for development |
| `BASE_URL_STAGING` | string | Yes | `https://staging.example.com` | Base URL for staging |
| `BASE_URL_PRODUCTION` | string | Yes | `https://example.com` | Base URL for production |
| `SUPPORT_EMAIL` | string | Yes | - | Support email address |

## Directory Structure

After initialization, you'll have this structure:

```
.
├── kustomark.yaml           # Root config (builds all environments)
├── README.md                # This file
├── base/                    # Base configuration
│   ├── kustomark.yaml       # Common patches
│   ├── getting-started.md   # Shared documentation
│   └── api-reference.md     # Shared API docs
├── dev/                     # Development overlay
│   └── kustomark.yaml       # Dev-specific patches
├── staging/                 # Staging overlay
│   └── kustomark.yaml       # Staging-specific patches
├── production/              # Production overlay
│   └── kustomark.yaml       # Production-specific patches
└── dist/                    # Output directory (gitignored)
    ├── dev/
    ├── staging/
    └── production/
```

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template multi-env
```

You'll be prompted for:
1. Project name (e.g., `MyProduct`)
2. Development URL (e.g., `https://dev.myproduct.com`)
3. Staging URL (e.g., `https://staging.myproduct.com`)
4. Production URL (e.g., `https://myproduct.com`)
5. Support email (e.g., `support@myproduct.com`)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template multi-env \
  --var PROJECT_NAME=MyProduct \
  --var BASE_URL_DEV=https://dev.myproduct.com \
  --var BASE_URL_STAGING=https://staging.myproduct.com \
  --var BASE_URL_PRODUCTION=https://myproduct.com \
  --var SUPPORT_EMAIL=support@myproduct.com
```

## Building Documentation

### Build Single Environment

Build for a specific environment:

```bash
# Development
kustomark build dev/ --output ./dist/dev

# Staging
kustomark build staging/ --output ./dist/staging

# Production
kustomark build production/ --output ./dist/production
```

### Build All Environments

Build all environments at once:

```bash
# Build all three environments
kustomark build dev/ --output ./dist/dev && \
kustomark build staging/ --output ./dist/staging && \
kustomark build production/ --output ./dist/production
```

Or use a script:

```bash
#!/bin/bash
for env in dev staging production; do
  echo "Building $env..."
  kustomark build $env/ --output ./dist/$env
done
```

## Environment-Specific Customizations

### Development Environment

Development documentation includes:
- Development warning banner
- Debug mode enabled
- Verbose logging examples
- Development tools links
- Relaxed rate limiting info
- CORS information

### Staging Environment

Staging documentation includes:
- Staging notice banner
- Production-like configuration
- Testing guidelines
- UAT information
- Deployment process notes

### Production Environment

Production documentation includes:
- Clean, polished content
- Debug sections removed
- Security best practices
- Production support information
- SLA details
- Strict error handling examples

## Customizing Environments

### Adding New Content

Add new markdown files to the base directory:

```bash
# Add to base/
echo "# New Guide" > base/new-guide.md

# Update base/kustomark.yaml
cat >> base/kustomark.yaml << EOF
resources:
  - getting-started.md
  - api-reference.md
  - new-guide.md
EOF
```

### Environment-Specific Patches

Customize how each environment transforms the content:

```yaml
# dev/kustomark.yaml
patches:
  # Add development-only section
  - op: append-to-section
    id: troubleshooting
    content: |
      ### Development Debugging

      Enable verbose logging:
      ```javascript
      DEBUG=* npm start
      ```
```

### Conditional Content

Show/hide content based on environment:

```yaml
# production/kustomark.yaml
patches:
  # Remove development sections
  - op: remove-section
    id: development-mode

  # Remove debug examples
  - op: replace-regex
    pattern: 'debug:\s*true'
    replacement: 'debug: false'
```

## Advanced Patterns

### Multiple Base Configurations

Create multiple base configurations for different documentation types:

```
base/
├── api/
│   ├── kustomark.yaml
│   └── endpoints.md
├── guides/
│   ├── kustomark.yaml
│   └── tutorials.md
└── reference/
    ├── kustomark.yaml
    └── cli.md
```

### Shared Overlays

Create shared overlays for common customizations:

```
overlays/
├── internal/          # Internal-only docs
│   └── kustomark.yaml
├── external/          # Public-facing docs
│   └── kustomark.yaml
└── partner/           # Partner docs
    └── kustomark.yaml
```

### Environment Variables

Use environment variables in patches:

```yaml
patches:
  - op: replace
    old: "{{API_KEY}}"
    new: "${API_KEY}"  # Resolved from environment
```

### Dynamic Configuration

Generate environment configs dynamically:

```javascript
// generate-configs.js
const environments = ['dev', 'staging', 'production'];

environments.forEach(env => {
  const config = {
    apiVersion: 'kustomark/v1',
    kind: 'Kustomization',
    resources: ['../base'],
    patches: [
      {
        op: 'replace',
        old: '{{BASE_URL}}',
        new: process.env[`BASE_URL_${env.toUpperCase()}`],
      },
    ],
  };

  fs.writeFileSync(
    `${env}/kustomark.yaml`,
    yaml.dump(config)
  );
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/docs.yml
name: Build Documentation

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, production]

    steps:
      - uses: actions/checkout@v3

      - name: Build ${{ matrix.environment }} docs
        run: |
          kustomark build ${{ matrix.environment }}/ \
            --output ./dist/${{ matrix.environment }}

      - name: Deploy to ${{ matrix.environment }}
        run: |
          aws s3 sync ./dist/${{ matrix.environment }} \
            s3://docs-${{ matrix.environment }}.example.com/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

.build_template:
  stage: build
  script:
    - kustomark build ${ENVIRONMENT}/ --output ./dist/${ENVIRONMENT}
  artifacts:
    paths:
      - dist/${ENVIRONMENT}

build:dev:
  extends: .build_template
  variables:
    ENVIRONMENT: dev

build:staging:
  extends: .build_template
  variables:
    ENVIRONMENT: staging

build:production:
  extends: .build_template
  variables:
    ENVIRONMENT: production
  only:
    - main
```

## Best Practices

### 1. Keep Base Generic

Keep base documentation generic and use environment overlays for specifics:

```markdown
<!-- base/getting-started.md -->
API endpoint: {{BASE_URL}}/api/v1
```

### 2. Use Consistent Naming

Use consistent section IDs for easier patching:

```markdown
## Getting Started {#getting-started}

## API Reference {#api-reference}

## Troubleshooting {#troubleshooting}
```

### 3. Document Environment Differences

Clearly document what differs between environments:

```markdown
## Environment Differences

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| Rate Limit | 100/min | 1000/min | 1000/min |
| Data | Mock | Test | Real |
| CORS | Any | Limited | Strict |
```

### 4. Test All Environments

Test builds for all environments:

```bash
npm test -- --env=all
```

### 5. Version Control Outputs

Consider versioning outputs for rollback capability:

```bash
git tag docs-v1.2.0
git checkout docs-v1.1.0 -- dist/production/
```

## Troubleshooting

### Patch Not Applying

If a patch doesn't apply to an environment:

```bash
# Check with verbose output
kustomark build dev/ -vv

# Preview patches
kustomark diff dev/
```

### Base Content Not Found

Ensure base resources are referenced correctly:

```yaml
# dev/kustomark.yaml
resources:
  - ../base  # Relative path to base
```

### URL Replacement Issues

Verify placeholder format matches:

```yaml
# Use exact placeholder from base docs
old: "{{BASE_URL}}"
new: "https://dev.example.com"
```

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [Overlay Pattern](https://github.com/yourusername/kustomark#overlays)
- [Multi-Environment Best Practices](https://github.com/yourusername/kustomark#multi-env)
