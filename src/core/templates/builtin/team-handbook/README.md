# Team Handbook Template

This template helps you create a comprehensive team handbook with onboarding, processes, policies, and resources.

## Use Case

Perfect for scenarios where you need to:
- Create a team handbook from scratch
- Onboard new team members effectively
- Document team processes and policies
- Centralize team knowledge and resources
- Maintain consistency across documentation
- Scale team operations

## How It Works

```
┌─────────────────┐
│  Individual     │
│  Sections       │
│                 │
│  - Welcome      │
│  - Onboarding   │
│  - Tools        │     ┌─────────────────┐
│  - Communication│ ──▶ │  Kustomark      │ ──▶  ┌─────────────────┐
│  - Development  │     │  Processing     │      │  Unified        │
│  - Meetings     │     │                 │      │  Team Handbook  │
│  - Policies     │     │  • Merge        │      │                 │
│  - Resources    │     │  • Format       │      │  HANDBOOK.md    │
│                 │     │  • Customize    │      └─────────────────┘
└─────────────────┘     └─────────────────┘
```

## Template Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `COMPANY_NAME` | string | Yes | - | Company or organization name |
| `TEAM_NAME` | string | Yes | - | Team or department name |
| `TEAM_LEAD` | string | Yes | - | Team lead or manager name |
| `TEAM_EMAIL` | string | Yes | - | Team contact email |
| `SLACK_CHANNEL` | string | Yes | - | Primary team Slack channel |
| `OFFICE_LOCATION` | string | Yes | - | Primary office location |

## Usage

### Interactive Mode

Run the template initialization wizard:

```bash
kustomark init --template team-handbook
```

You'll be prompted for:
1. Company name (e.g., `ACME Corp`)
2. Team name (e.g., `Engineering`)
3. Team lead name (e.g., `Jane Doe`)
4. Team email (e.g., `engineering@example.com`)
5. Slack channel (e.g., `#engineering`)
6. Office location (e.g., `San Francisco, CA`)

### Non-Interactive Mode

Provide all variables via command-line flags:

```bash
kustomark init --template team-handbook \
  --var COMPANY_NAME="ACME Corp" \
  --var TEAM_NAME=Engineering \
  --var TEAM_LEAD="Jane Doe" \
  --var TEAM_EMAIL=engineering@example.com \
  --var SLACK_CHANNEL="#engineering" \
  --var OFFICE_LOCATION="San Francisco, CA"
```

## What Gets Created

After initialization, you'll have:

1. **kustomark.yaml** - Configuration file with:
   - Section merging configuration
   - Variable substitution
   - Formatting rules
   - Table of contents generation

2. **README.md** - This documentation file

3. **sections/** directory with:
   - `welcome.md` - Team welcome and overview
   - `onboarding.md` - Onboarding checklist and timeline
   - `tools-and-access.md` - Tools and access procedures
   - `communication.md` - Communication guidelines
   - `development-process.md` - Development workflow
   - `meetings.md` - Meeting schedule and guidelines
   - `policies.md` - Team and company policies
   - `resources.md` - Links and resources

4. **output/** directory:
   - `HANDBOOK.md` - Complete merged handbook

## Directory Structure

```
.
├── kustomark.yaml           # Configuration
├── README.md                # This file
├── sections/                # Individual sections
│   ├── welcome.md
│   ├── onboarding.md
│   ├── tools-and-access.md
│   ├── communication.md
│   ├── development-process.md
│   ├── meetings.md
│   ├── policies.md
│   └── resources.md
└── output/                  # Generated handbook
    └── HANDBOOK.md
```

## Handbook Sections

### 1. Welcome

- Team overview
- Mission and values
- Team leadership
- Quick links

### 2. Onboarding

- First day checklist
- First week goals
- First month milestones
- Access and setup
- Learning resources

### 3. Tools and Access

- Development tools
- Collaboration tools
- Cloud infrastructure
- Monitoring tools
- Access request process

### 4. Communication

- Channel guidelines
- Meeting culture
- Async communication
- Working hours
- Feedback practices

### 5. Development Process

- Git workflow
- Code review
- Testing standards
- Deployment process
- Best practices

### 6. Meetings

- Regular meetings
- Meeting guidelines
- Special ceremonies
- Meeting-free time

### 7. Policies

- Work hours
- Time off
- Code of conduct
- Security
- Professional development

### 8. Resources

- Team contacts
- Documentation
- Tools and services
- Learning resources
- Emergency contacts

## Customizing the Handbook

### Adding New Sections

Create a new section file:

```bash
echo "# New Section" > sections/new-section.md
```

Add to `kustomark.yaml`:

```yaml
resources:
  - sections/welcome.md
  - sections/onboarding.md
  # ... existing sections
  - sections/new-section.md
```

### Removing Sections

Simply remove the section from the resources list in `kustomark.yaml`.

### Customizing Content

Edit any section file to match your team's needs:

```bash
# Edit onboarding section
vim sections/onboarding.md

# Rebuild handbook
kustomark build
```

### Team-Specific Sections

Add sections unique to your team:

```bash
# Backend team
echo "# Backend Architecture" > sections/backend-architecture.md

# Mobile team
echo "# Mobile Development Guide" > sections/mobile-guide.md

# DevOps team
echo "# Infrastructure Runbooks" > sections/runbooks.md
```

## Building the Handbook

### Build Complete Handbook

```bash
kustomark build
```

Output: `output/HANDBOOK.md`

### Build Individual Sections

Keep sections separate instead of merging:

```yaml
# kustomark.yaml
merge:
  enabled: false  # Disable merging
```

### Generate PDF

```bash
# Install pandoc
brew install pandoc

# Build markdown
kustomark build

# Convert to PDF
pandoc output/HANDBOOK.md -o HANDBOOK.pdf \
  --toc \
  --toc-depth=3 \
  -V geometry:margin=1in
```

### Generate Website

```bash
# Build markdown
kustomark build

# Use MkDocs
cd output
mkdocs new .
# Configure mkdocs.yml
mkdocs serve

# Or use Docsify
npx docsify-cli init ./output
npx docsify-cli serve ./output
```

## Advanced Customization

### Custom Formatting

Add custom formatting rules in `kustomark.yaml`:

```yaml
patches:
  # Add emoji to headers
  - op: replace-regex
    pattern: '^## (.+)$'
    replacement: '## 📖 $1'
    flags: gm

  # Highlight important notes
  - op: replace-regex
    pattern: '\*\*Important:\*\*'
    replacement: '> ⚠️ **Important:**'
    flags: g
```

### Version Control

Track handbook changes:

```bash
# Initialize git repo
git init
git add .
git commit -m "Initial team handbook"

# Create versions
git tag v1.0.0

# Track changes
git log --oneline sections/
```

### Automated Updates

Use GitHub Actions to auto-build:

```yaml
# .github/workflows/handbook.yml
name: Build Handbook

on:
  push:
    paths:
      - 'sections/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build handbook
        run: kustomark build

      - name: Commit updated handbook
        run: |
          git config user.name "Handbook Bot"
          git config user.email "bot@example.com"
          git add output/HANDBOOK.md
          git commit -m "Update handbook [skip ci]"
          git push
```

### Multi-Team Handbooks

Maintain handbooks for multiple teams:

```
handbooks/
├── engineering/
│   ├── sections/
│   └── kustomark.yaml
├── design/
│   ├── sections/
│   └── kustomark.yaml
└── product/
    ├── sections/
    └── kustomark.yaml
```

Build all:

```bash
for team in engineering design product; do
  cd handbooks/$team
  kustomark build
  cd ../..
done
```

## Publishing the Handbook

### Internal Wiki

Publish to Confluence:

```bash
# Build handbook
kustomark build

# Upload to Confluence
confluence-cli \
  --space TEAM \
  --title "Team Handbook" \
  --file output/HANDBOOK.md
```

### Notion

Import into Notion:
1. Build handbook
2. Open Notion
3. Import → Markdown
4. Select `output/HANDBOOK.md`

### GitHub Wiki

Publish to GitHub wiki:

```bash
# Build handbook
kustomark build

# Clone wiki
git clone https://github.com/org/repo.wiki.git

# Copy handbook
cp output/HANDBOOK.md repo.wiki/Home.md

# Commit and push
cd repo.wiki
git add .
git commit -m "Update handbook"
git push
```

### Static Site

Deploy as a website:

```bash
# Build with MkDocs
kustomark build
cd output
mkdocs build

# Deploy to Netlify
netlify deploy --dir=site

# Or GitHub Pages
mkdocs gh-deploy
```

## Maintenance

### Regular Updates

**Quarterly Review:**
- Update policies
- Refresh links
- Add new tools
- Archive outdated content

**Monthly Updates:**
- Update team roster
- Refresh meeting schedules
- Update on-call rotations

**Continuous Updates:**
- New hire feedback
- Process changes
- Tool changes

### Ownership

Assign section owners:

```markdown
<!-- sections/development-process.md -->
**Section Owner:** @tech-lead
**Last Updated:** 2024-03-15
**Next Review:** 2024-06-15
```

### Feedback Loop

Collect feedback:

```markdown
<!-- Add to end of sections -->

## Feedback

Help us improve this section! Share feedback:
- Create issue in handbook repo
- Message in #handbook-feedback
- Talk to {{TEAM_LEAD}}
```

## Best Practices

### 1. Keep It Current

Set reminders to review and update regularly.

### 2. Make It Accessible

- Easy to find (pin in Slack)
- Easy to search (good structure)
- Easy to read (clear formatting)

### 3. Include Examples

Show, don't just tell:

```markdown
# Bad
Follow the PR template

# Good
Follow the PR template:

\`\`\`markdown
## Description
Added user authentication

## Testing
- [x] Unit tests pass
- [x] Manual testing complete
\`\`\`
```

### 4. Get Team Input

- Review in team meetings
- Collect feedback from new hires
- Regular retrospective reviews
- Open contribution model

### 5. Version Important Changes

Track major updates:

```markdown
## Changelog

### v2.0.0 - 2024-03-15
- Updated remote work policy
- Added new tools section
- Revised on-call process

### v1.0.0 - 2024-01-01
- Initial handbook release
```

## Troubleshooting

### Merging Issues

If sections don't merge correctly:

```yaml
# Check merge configuration
merge:
  enabled: true
  strategy: concatenate
  separator: "\n\n---\n\n"
```

### Variable Substitution

If variables aren't replaced:

```bash
# Check variable syntax matches
grep "{{COMPANY_NAME}}" sections/*.md

# Rebuild with verbose output
kustomark build -vv
```

### Table of Contents

If TOC doesn't generate:

```yaml
# Enable TOC in kustomark.yaml
toc:
  enabled: true
  position: after-header
  max_depth: 3
```

## Examples

Build the example handbook:

```bash
kustomark build
cat output/HANDBOOK.md
```

## Learn More

- [Kustomark Documentation](https://github.com/yourusername/kustomark)
- [Team Handbook Best Practices](https://handbook.gitlab.com/)
- [Documentation Guide](https://www.writethedocs.org/)
- [Markdown Guide](https://www.markdownguide.org/)
