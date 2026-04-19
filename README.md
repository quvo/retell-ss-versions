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
