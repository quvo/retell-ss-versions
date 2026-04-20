/**
 * Verification script: Check migration integrity
 * Verifies all snapshots exist and checksums match
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

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

const AGENTS_DIR = "snapshots/agents";
const INDEX_PATH = `${AGENTS_DIR}/index.json`;

function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function main() {
  console.log(`\n🔍 Verifying Agent Snapshot Migration\n`);

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
  let validSnapshots = 0;
  let errors: string[] = [];

  // Verify each agent
  console.log("2️⃣  Verifying snapshots...\n");
  for (const agentId of agentIds) {
    const entry = index[agentId];
    const snapshotCount = entry.snapshots.length;
    totalSnapshots += snapshotCount;

    console.log(`   Agent ${agentId.replace('agent_', '')}:`);

    // Check agent_name exists
    if (!entry.agent_name) {
      console.log(`   ⚠️  No agent_name in index`);
      errors.push(`Missing agent_name for ${agentId}`);
    } else {
      console.log(`   - Name: ${entry.agent_name}`);
    }

    // Verify each snapshot
    for (const snapshot of entry.snapshots) {
      const snapshotPath = path.join(AGENTS_DIR, snapshot.file);

      // Check file exists
      if (!fs.existsSync(snapshotPath)) {
        console.log(`   ❌ Missing: ${snapshot.file}`);
        errors.push(`Missing file: ${snapshot.file}`);
        continue;
      }

      // Verify checksum
      try {
        const snapshotData = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
        const actualChecksum = calculateChecksum(snapshotData);
        const expectedChecksum = snapshot.checksum.replace('sha256:', '');

        if (actualChecksum !== expectedChecksum) {
          console.log(`   ❌ Checksum mismatch: ${snapshot.file}`);
          errors.push(`Checksum mismatch: ${snapshot.file}`);
          continue;
        }

        validSnapshots++;
      } catch (error: any) {
        console.log(`   ❌ Error reading ${snapshot.file}: ${error.message}`);
        errors.push(`Read error: ${snapshot.file}`);
      }
    }

    console.log(`   ✅ ${entry.snapshots.length} snapshots verified`);
  }

  // Check for orphaned files (files not in index)
  console.log(`\n3️⃣  Checking for orphaned files...\n`);
  const folders = fs.readdirSync(AGENTS_DIR).filter(name => {
    const fullPath = path.join(AGENTS_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });

  let orphanedFiles = 0;
  for (const folder of folders) {
    const folderPath = path.join(AGENTS_DIR, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const relativePath = `${folder}/${file}`;
      let found = false;

      for (const agentId of agentIds) {
        const entry = index[agentId];
        if (entry.snapshots.some(s => s.file === relativePath)) {
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(`   ⚠️  Orphaned file: ${relativePath}`);
        orphanedFiles++;
      }
    }
  }

  if (orphanedFiles === 0) {
    console.log(`   ✅ No orphaned files found`);
  }

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (errors.length === 0 && orphanedFiles === 0) {
    console.log(`✅ VERIFICATION PASSED`);
  } else {
    console.log(`❌ VERIFICATION FAILED`);
  }
  console.log(`   Total agents: ${agentIds.length}`);
  console.log(`   Total snapshots: ${totalSnapshots}`);
  console.log(`   Valid snapshots: ${validSnapshots}`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Orphaned files: ${orphanedFiles}`);

  if (errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more`);
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  process.exit(errors.length > 0 || orphanedFiles > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
