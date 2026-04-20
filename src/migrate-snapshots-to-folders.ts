/**
 * Migration script: Flat structure → Folder structure
 * Reorganizes agent snapshots into per-agent folders
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAgentFolderName } from "./utils/folder-naming.js";

interface SnapshotMetadata {
  version: number;
  timestamp: string;
  file: string;
  checksum: string;
  voice_id?: string;
  captured_by: string;
}

interface AgentIndexEntry {
  current_version: number;
  agent_name?: string;
  snapshots: SnapshotMetadata[];
}

interface AgentIndex {
  [agentId: string]: AgentIndexEntry;
}

const DRY_RUN = !process.argv.includes('--execute');
const AGENTS_DIR = "snapshots/agents";
const INDEX_PATH = `${AGENTS_DIR}/index.json`;

function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  console.log(`\n🔄 Agent Snapshot Migration: Flat → Folder Structure`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (preview only)' : 'EXECUTE (making changes)'}\n`);

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ Error: Index file not found: ${INDEX_PATH}`);
    process.exit(1);
  }

  // Load index
  console.log("1️⃣  Loading index.json...");
  const index: AgentIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const agentIds = Object.keys(index);
  console.log(`   Found ${agentIds.length} agents\n`);

  let totalSnapshots = 0;
  let migratedSnapshots = 0;
  let errors: string[] = [];

  // Process each agent
  console.log("2️⃣  Processing agents...");
  for (const agentId of agentIds) {
    const entry = index[agentId];
    const snapshotCount = entry.snapshots.length;
    totalSnapshots += snapshotCount;

    console.log(`\n   Agent ${agentId.replace('agent_', '')}:`);
    console.log(`   - Snapshots: ${snapshotCount}`);

    // Extract agent name from first snapshot file
    if (entry.snapshots.length === 0) {
      console.log(`   ⚠️  No snapshots, skipping`);
      continue;
    }

    const firstSnapshotFile = path.join(AGENTS_DIR, entry.snapshots[0].file);
    if (!fs.existsSync(firstSnapshotFile)) {
      console.log(`   ❌ First snapshot not found: ${firstSnapshotFile}`);
      errors.push(`Missing file: ${firstSnapshotFile}`);
      continue;
    }

    const firstSnapshot = JSON.parse(fs.readFileSync(firstSnapshotFile, "utf-8"));
    const agentName = firstSnapshot.agent_name;

    if (!agentName) {
      console.log(`   ❌ No agent_name in snapshot`);
      errors.push(`No agent_name for ${agentId}`);
      continue;
    }

    console.log(`   - Name: ${agentName}`);

    // Generate folder name
    const folderName = getAgentFolderName(agentName, agentId);
    const folderPath = path.join(AGENTS_DIR, folderName);
    console.log(`   - Folder: ${folderName}`);

    // Create folder
    if (!DRY_RUN) {
      ensureDirectoryExists(folderPath);
    } else {
      console.log(`   [DRY-RUN] Would create: ${folderPath}`);
    }

    // Migrate each snapshot
    for (const snapshot of entry.snapshots) {
      const oldPath = path.join(AGENTS_DIR, snapshot.file);

      // Extract version and timestamp from old filename
      const match = snapshot.file.match(/_v(\d+)_(\d+)\.json$/);
      if (!match) {
        console.log(`   ❌ Cannot parse filename: ${snapshot.file}`);
        errors.push(`Cannot parse: ${snapshot.file}`);
        continue;
      }

      const [, version, timestamp] = match;
      const newFilename = `v${version}_${timestamp}.json`;
      const newPath = path.join(folderPath, newFilename);
      const newRelativePath = `${folderName}/${newFilename}`;

      // Verify old file exists
      if (!fs.existsSync(oldPath)) {
        console.log(`   ❌ File not found: ${oldPath}`);
        errors.push(`Missing: ${oldPath}`);
        continue;
      }

      // Read and verify checksum
      const snapshotData = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
      const actualChecksum = calculateChecksum(snapshotData);
      const expectedChecksum = snapshot.checksum.replace('sha256:', '');

      if (actualChecksum !== expectedChecksum) {
        console.log(`   ❌ Checksum mismatch for ${snapshot.file}`);
        errors.push(`Checksum mismatch: ${snapshot.file}`);
        continue;
      }

      // Move file
      if (!DRY_RUN) {
        fs.copyFileSync(oldPath, newPath);
      }

      // Update snapshot entry
      snapshot.file = newRelativePath;
      migratedSnapshots++;
    }

    // Update agent_name in index
    if (!DRY_RUN) {
      entry.agent_name = agentName;
    }

    console.log(`   ✅ Migrated ${entry.snapshots.length} snapshots`);
  }

  // Save updated index
  console.log(`\n3️⃣  Updating index.json...`);
  if (!DRY_RUN) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    console.log(`   ✅ Index updated`);
  } else {
    console.log(`   [DRY-RUN] Would update index.json`);
  }

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${DRY_RUN ? '📋 DRY-RUN SUMMARY' : '✅ MIGRATION COMPLETE'}`);
  console.log(`   Total agents: ${agentIds.length}`);
  console.log(`   Total snapshots: ${totalSnapshots}`);
  console.log(`   Migrated: ${migratedSnapshots}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    errors.forEach(err => console.log(`   - ${err}`));
  }

  if (DRY_RUN) {
    console.log(`\n💡 To execute migration, run:`);
    console.log(`   npm run migrate-snapshots -- --execute`);
  } else {
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run verification: npm run verify-migration`);
    console.log(`   2. Test rollback: npm run rollback -- --type agent --id <id> --list`);
    console.log(`   3. Commit changes: git add snapshots/ && git commit`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
