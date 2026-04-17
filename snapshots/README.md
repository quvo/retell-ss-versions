# Retell AI Snapshots Archive

This branch contains automated snapshots of Retell AI resources (conversation flows, agents, and components).

## Structure

- `flows/` - Conversation flow snapshots
- `agents/` - Voice agent snapshots
- `components/` - Shared component snapshots

Each directory contains:
- `index.json` - Metadata index with version history
- Individual snapshot files with naming pattern: `{type}_{id}_v{version}_{timestamp}.json`

## Automation

Snapshots are collected automatically every 15 minutes by GitHub Actions.
See workflow: `.github/workflows/snapshot-collector.yml` on main branch.

## Usage

To view snapshots:
```bash
git checkout snapshots-archive
ls -la snapshots/flows/
cat snapshots/flows/index.json
```

To restore from a snapshot, see the rollback scripts on the main branch.
