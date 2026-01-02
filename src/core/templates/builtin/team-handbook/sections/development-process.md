# Development Process

How we build and ship software.

## Development Workflow

### 1. Planning

**Sprint Planning (Biweekly)**
- Review backlog
- Estimate stories
- Commit to sprint goals
- Assign work

**Refinement (Weekly)**
- Break down epics
- Add acceptance criteria
- Technical design
- Dependency identification

### 2. Development

**Workflow:**

```
1. Pick a ticket from sprint board
2. Create feature branch
3. Write code + tests
4. Submit pull request
5. Address review feedback
6. Merge to main
7. Deploy to staging
8. Validate
9. Deploy to production
10. Monitor
```

**Branch Naming:**

```bash
# Format: type/ticket-number-description
feature/ENG-123-user-authentication
bugfix/ENG-456-fix-login-error
hotfix/ENG-789-critical-security-patch
```

**Commit Messages:**

```bash
# Format: type(scope): description
feat(auth): add OAuth2 integration
fix(api): resolve race condition in user updates
docs(readme): update installation instructions
test(auth): add integration tests for login flow

# With ticket reference
feat(auth): add OAuth2 integration [ENG-123]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Maintenance

### 3. Code Review

**Pull Request Template:**

```markdown
## Description
[What does this PR do?]

## Ticket
Closes ENG-XXX

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots
[If UI change]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings
```

**Review Process:**

1. **Author Responsibilities:**
   - Self-review first
   - Add context and screenshots
   - Request specific reviewers
   - Respond to feedback promptly

2. **Reviewer Responsibilities:**
   - Review within 24 hours
   - Be constructive
   - Test locally if needed
   - Approve or request changes

3. **Review Criteria:**
   - Code quality and style
   - Test coverage
   - Performance impact
   - Security considerations
   - Documentation

**Review Comments:**

```markdown
# Blocking (must fix)
🚨 This introduces a SQL injection vulnerability

# Suggestion (nice to have)
💡 Consider using a const here for better readability

# Question (needs clarification)
❓ Why did we choose this approach over X?

# Praise (good work!)
🎉 Great test coverage!
```

### 4. Testing

**Test Pyramid:**

```
        /\
       /E2E\      (Few - Critical paths)
      /------\
     /Integration\ (Some - Key flows)
    /----------\
   /   Unit    \ (Many - All logic)
  /--------------\
```

**Test Requirements:**

- Unit tests: 80%+ coverage
- Integration tests: Critical paths
- E2E tests: Main user journeys
- All tests pass before merge

**Running Tests:**

```bash
# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

**Writing Good Tests:**

```javascript
describe('User Authentication', () => {
  it('should successfully authenticate with valid credentials', async () => {
    // Arrange
    const credentials = { email: 'test@example.com', password: 'valid' };

    // Act
    const result = await authenticate(credentials);

    // Assert
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should reject authentication with invalid credentials', async () => {
    // Arrange
    const credentials = { email: 'test@example.com', password: 'wrong' };

    // Act & Assert
    await expect(authenticate(credentials)).rejects.toThrow('Invalid credentials');
  });
});
```

### 5. Deployment

**Environments:**

```
Development → Staging → Production
(automatic)  (automatic) (manual approval)
```

**CI/CD Pipeline:**

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    - Run linter
    - Run tests
    - Check coverage

  build:
    - Build application
    - Build Docker image
    - Push to registry

  deploy-staging:
    - Deploy to staging
    - Run smoke tests
    - Notify team

  deploy-production:
    - Wait for approval
    - Deploy to production
    - Run smoke tests
    - Monitor metrics
    - Notify team
```

**Deployment Checklist:**

Before deploying:
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Migration scripts tested
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured

**Production Deployments:**

- **When:** Daily at 10 AM and 2 PM {{OFFICE_LOCATION}} time
- **Who:** On-duty engineer or author
- **Process:**
  1. Merge to main
  2. Automatic staging deployment
  3. Validate in staging
  4. Approve production deployment
  5. Monitor for 30 minutes

**Emergency Hotfixes:**

```bash
# Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/ENG-XXX-description

# Make fix
# Fast-track review
# Deploy immediately
# Follow up with post-mortem
```

## Code Standards

### Style Guide

**JavaScript/TypeScript:**

```typescript
// Use const by default
const MAX_RETRIES = 3;

// Use descriptive names
function calculateUserScore(user: User): number {
  // Implementation
}

// Use TypeScript types
interface User {
  id: string;
  name: string;
  email: string;
}

// Async/await over promises
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Error handling
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new OperationError('Failed to complete operation', error);
}
```

**Formatting:**

```bash
# Prettier for auto-formatting
npm run format

# ESLint for linting
npm run lint

# Fix automatically
npm run lint:fix
```

**File Organization:**

```
src/
├── components/     # React components
├── services/      # Business logic
├── utils/         # Helper functions
├── types/         # TypeScript types
├── hooks/         # Custom React hooks
├── api/           # API client
├── config/        # Configuration
└── tests/         # Test files
```

### Documentation

**Code Comments:**

```typescript
// ✅ Good - Explains WHY
// Using exponential backoff to avoid overwhelming the API
// during high traffic periods
const delay = Math.pow(2, retryCount) * 1000;

// ❌ Bad - Explains WHAT (obvious from code)
// Set delay to 2 to the power of retryCount times 1000
const delay = Math.pow(2, retryCount) * 1000;
```

**Function Documentation:**

```typescript
/**
 * Calculates the user's reputation score based on activity.
 *
 * Score is calculated from:
 * - Number of contributions (weight: 0.4)
 * - Quality rating (weight: 0.3)
 * - Consistency (weight: 0.3)
 *
 * @param userId - The unique identifier for the user
 * @param timeRange - Time range for calculation (default: 30 days)
 * @returns Score between 0-100
 * @throws {UserNotFoundError} If user doesn't exist
 */
async function calculateReputationScore(
  userId: string,
  timeRange: number = 30
): Promise<number> {
  // Implementation
}
```

**README Files:**

Every project should have:
- Overview and purpose
- Installation instructions
- Usage examples
- Configuration
- Development setup
- Testing instructions
- Deployment process
- Contributing guidelines

## Best Practices

### Performance

```typescript
// ✅ Memoize expensive calculations
const memoizedValue = useMemo(() =>
  expensiveCalculation(a, b),
  [a, b]
);

// ✅ Debounce user input
const debouncedSearch = debounce(searchFunction, 300);

// ✅ Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// ✅ Use pagination for large lists
const { data, hasMore } = usePagination(items, { pageSize: 50 });
```

### Security

```typescript
// ✅ Validate input
const sanitizedInput = validator.escape(userInput);

// ✅ Use parameterized queries
const user = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ✅ Don't commit secrets
const apiKey = process.env.API_KEY;

// ✅ Use security headers
app.use(helmet());

// ✅ Implement rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### Error Handling

```typescript
// ✅ Create custom error types
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ✅ Log errors with context
logger.error('User creation failed', {
  error: error.message,
  userId: userId,
  timestamp: new Date().toISOString(),
  stack: error.stack
});

// ✅ Provide user-friendly messages
catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Invalid input',
      field: error.field
    });
  }
  // Log but don't expose internal errors
  logger.error(error);
  return res.status(500).json({
    error: 'Something went wrong'
  });
}
```

## Monitoring and Debugging

### Logging

```typescript
// Structured logging
logger.info('User logged in', {
  userId: user.id,
  ip: req.ip,
  timestamp: new Date().toISOString()
});

// Log levels
logger.debug('Debug information');
logger.info('Informational message');
logger.warn('Warning message');
logger.error('Error occurred', { error });
```

### Monitoring

**Key Metrics:**
- Response time
- Error rate
- Request rate
- Database query time
- CPU/Memory usage

**Alerting:**
- Error rate > 1%
- Response time > 1s (95th percentile)
- CPU > 80%
- Memory > 90%

### Debugging

```typescript
// Use debugger
debugger;

// Console logging (remove before commit)
console.log('Debug:', value);

// VS Code debugging
// Set breakpoints and use debug panel

// Remote debugging
node --inspect server.js
```

## Questions?

For questions about our development process, ask in {{SLACK_CHANNEL}} or contact {{TEAM_LEAD}}.
