# Retell AI Snapshot Version Control

Automated snapshot collection system for Retell AI resources (agents, conversation flows, and components) using GitHub Actions.

## Architecture

```
Retell AI API
    │
    ▼
┌─────────────────────────┐
│  GitHub Actions         │
│  (Cron: every 15 min)   │
│  - List all resources   │
│  - Compare versions     │
│  - Download new ones    │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  snapshots-archive      │  ← Orphan branch
│  - flows/               │
│  - agents/              │
│  - components/          │
│  - index.json (each)    │
└─────────────────────────┘
```

## Features

- **Automated collection**: Runs every 15 minutes via GitHub Actions
- **Version tracking**: Only downloads new versions (based on version number or checksum)
- **Full history**: Git branch keeps all snapshots forever
- **Slack notifications**: Alerts when new versions are captured
- **Metadata**: Checksums, timestamps, node/tool counts in index files
- **Rollback**: Restore agents/flows/components to any previous version

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

`.env`:
```
RETELL_API_KEY=your_retell_api_key
```

### 3. GitHub Secrets

Add these secrets in repository settings (`Settings → Secrets and variables → Actions`):

- `RETELL_API_KEY`: Your Retell AI API key
- `SLACK_WEBHOOK_URL`: (Optional) Slack incoming webhook URL

### 4. Deploy

Push to GitHub and the workflow will run automatically every 15 minutes (at :07, :22, :37, :52).

Manual trigger:
```bash
gh workflow run retell-snapshot-cron.yml
```

## Usage

### Local snapshot collection

```bash
npm run snapshot-collect
```

### View snapshots

All snapshots are stored in the `snapshots-archive` branch:

```bash
git checkout snapshots-archive
ls snapshots/flows/
ls snapshots/agents/
ls snapshots/components/
```

### Snapshot file naming

```
flow_{id}_v{version}_{timestamp}.json
agent_{id}_v{version}_{timestamp}.json
component_{id}_{checksum}_{timestamp}.json
```

Example: `flow_abc123_v42_20260418033000.json`

## Rollback

Restore agents, flows, or components to any previous version captured in snapshots.

### CLI Usage

**List available versions:**
```bash
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --list
```

**Dry-run (preview changes without applying):**
```bash
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --version 51
```

**Execute rollback:**
```bash
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --version 51 --execute
```

**Rollback flow:**
```bash
npm run rollback -- --type flow --id 0172d190e785 --version 60 --execute
```

**Rollback component (by timestamp):**
```bash
npm run rollback -- --type component --id component_abc123 --timestamp 2026-04-18T01:44:30.000Z --execute
```

### GitHub Actions (Web UI)

Non-technical users can rollback via browser:

1. Go to **Actions** tab → **Retell AI Rollback**
2. Click **Run workflow**
3. Fill in the form:
   - **Resource type**: agent / flow / component
   - **Resource ID**: Short ID (e.g., `71b06ec7239ceda05eae083b4c`)
   - **Target version**: Version number (for agents/flows)
   - **Dry run**: ✅ Yes (recommended to preview first)
4. Click **Run workflow**
5. View results in workflow summary

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--type` | Resource type: `agent`, `flow`, `component` | (required) |
| `--id` | Resource ID (short ID without prefix) | (required) |
| `--version` | Target version number (agents/flows) | (required for agents/flows) |
| `--timestamp` | Target timestamp (components) | (required for components) |
| `--execute` | Execute rollback (without this, dry-run only) | `false` (dry-run) |
| `--no-publish` | Skip auto-publish after agent rollback | `false` (auto-publish) |
| `--list` | List available versions | `false` |

### How Rollback Works

**Important**: Retell API doesn't support direct version rollback. Instead, rollback creates a **new version** with old content:

```
v52 (current) → rollback to v51 → v53 (new version with v51 content)
```

This is **non-destructive** and allows re-rollback if needed.

**Process:**
1. **Pre-validation**: Check snapshot exists, verify API connectivity
2. **Diff preview**: Show changes to be applied
3. **Execute**: Update resource via Retell API (if `--execute`)
4. **Post-validation**: Verify rollback succeeded
5. **Audit log**: Record operation in `rollback-audit.jsonl`

### Safety Features

- **Dry-run by default**: Preview changes before applying
- **Pre-validation**: Verify snapshot integrity and API connectivity
- **Post-validation**: Confirm rollback succeeded
- **Audit trail**: All rollbacks logged to `rollback-audit.jsonl`
- **Non-destructive**: Creates new version, doesn't delete history

### Examples

**Emergency rollback (agent broke in production):**
```bash
# 1. List versions to find last working version
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --list

# 2. Preview rollback
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --version 51

# 3. Execute
npm run rollback -- --type agent --id 71b06ec7239ceda05eae083b4c --version 51 --execute
```

**Testing a rollback:**
```bash
# Use dry-run first to see what would change
npm run rollback -- --type flow --id 0172d190e785 --version 60

# If changes look good, execute
npm run rollback -- --type flow --id 0172d190e785 --version 60 --execute
```

## Customization

### Change schedule frequency

Edit `.github/workflows/retell-snapshot-cron.yml`:

```yaml
on:
  schedule:
    - cron: '7,22,37,52 * * * *'  # Every 15 minutes
```

For 5-minute intervals:
```yaml
- cron: '3,8,13,18,23,28,33,38,43,48,53,58 * * * *'
```

### Component change detection

Components don't have version numbers, so we use SHA-256 checksums to detect changes.

## Why API over GUI?

| | GUI (Dashboard) | API (This approach) |
|---|---|---|
| Setup speed | Fast (drag & drop) | Slower (write code) |
| Reproducibility | Low (manual) | High (code-defined) |
| Version control | None | Git managed |
| Environment cloning | Manual copy | `npm run deploy` |
| CI/CD integration | Not possible | Possible |
| Review | Screen sharing | PR review |
| Automation | Limited | Full automation |

API approach enables **Infrastructure as Code**: track changes, review with team, and safely deploy to production.

## Troubleshooting

### Scheduled workflow not running

GitHub Actions may delay scheduled triggers for new repositories (up to 24 hours). If urgent:

1. Trigger manually: `gh workflow run retell-snapshot-cron.yml`
2. Use n8n to call `workflow_dispatch` via API

### No changes detected despite updates

Check if version numbers actually incremented in Retell Dashboard. Components use checksums instead of versions.

## License

MIT
