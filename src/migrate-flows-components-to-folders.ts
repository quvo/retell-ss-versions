/**
 * Migration script: Flows & Components to folder structure
 * Reorganizes flow and component snapshots into folders
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAgentFolderName, sanitizeFolderName } from "./utils/folder-naming.js";

const DRY_RUN = !process.argv.includes('--execute');

function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function shortId(fullId: string): string {
  return fullId.replace(/^(conversation_flow_|conversation_flow_component_)/, "");
}

async function migrateFlows() {
  console.log("\n📋 Migrating Flows...");

  const FLOWS_DIR = "snapshots/flows";
  const INDEX_PATH = `${FLOWS_DIR}/index.json`;

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ Error: Index file not found: ${INDEX_PATH}`);
    return { total: 0, migrated: 0, errors: [] };
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const flowIds = Object.keys(index);
  let totalSnapshots = 0;
  let migratedSnapshots = 0;
  const errors: string[] = [];

  console.log(`   Found ${flowIds.length} flows\n`);

  for (const flowId of flowIds) {
    const entry = index[flowId];
    const snapshotCount = entry.snapshots.length;
    totalSnapshots += snapshotCount;

    console.log(`   Flow ${shortId(flowId)}:`);
    console.log(`   - Snapshots: ${snapshotCount}`);

    if (snapshotCount === 0) {
      console.log(`   ⚠️  No snapshots, skipping`);
      continue;
    }

    // Flows don't have names, use ID only
    const flowShortId = shortId(flowId);
    const folderName = `flow_${flowShortId}`;
    const folderPath = path.join(FLOWS_DIR, folderName);

    console.log(`   - Folder: ${folderName}`);

    if (!DRY_RUN) {
      ensureDirectoryExists(folderPath);
    } else {
      console.log(`   [DRY-RUN] Would create: ${folderPath}`);
    }

    for (const snapshot of entry.snapshots) {
      const oldPath = path.join(FLOWS_DIR, snapshot.file);

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

      if (!fs.existsSync(oldPath)) {
        console.log(`   ❌ File not found: ${oldPath}`);
        errors.push(`Missing: ${oldPath}`);
        continue;
      }

      // Verify checksum
      const snapshotData = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
      const actualChecksum = calculateChecksum(snapshotData);
      const expectedChecksum = snapshot.checksum.replace('sha256:', '');

      if (actualChecksum !== expectedChecksum) {
        console.log(`   ❌ Checksum mismatch for ${snapshot.file}`);
        errors.push(`Checksum mismatch: ${snapshot.file}`);
        continue;
      }

      if (!DRY_RUN) {
        fs.copyFileSync(oldPath, newPath);
      }

      snapshot.file = `${folderName}/${newFilename}`;
      migratedSnapshots++;
    }

    console.log(`   ✅ Migrated ${entry.snapshots.length} snapshots`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    console.log(`\n   ✅ Flow index updated`);
  } else {
    console.log(`\n   [DRY-RUN] Would update index.json`);
  }

  return { total: totalSnapshots, migrated: migratedSnapshots, errors };
}

async function migrateComponents() {
  console.log("\n🧩 Migrating Components...");

  const COMPONENTS_DIR = "snapshots/components";
  const INDEX_PATH = `${COMPONENTS_DIR}/index.json`;

  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`❌ Error: Index file not found: ${INDEX_PATH}`);
    return { total: 0, migrated: 0, errors: [] };
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  const componentIds = Object.keys(index);
  let totalSnapshots = 0;
  let migratedSnapshots = 0;
  const errors: string[] = [];

  console.log(`   Found ${componentIds.length} components\n`);

  for (const componentId of componentIds) {
    const entry = index[componentId];
    const componentName = entry.name;
    const snapshotCount = entry.snapshots.length;
    totalSnapshots += snapshotCount;

    console.log(`   Component ${shortId(componentId)}:`);
    console.log(`   - Name: ${componentName}`);
    console.log(`   - Snapshots: ${snapshotCount}`);

    if (snapshotCount === 0) {
      console.log(`   ⚠️  No snapshots, skipping`);
      continue;
    }

    // Create folder: {component_name}_{component_id}
    const folderName = getAgentFolderName(componentName, componentId);
    const folderPath = path.join(COMPONENTS_DIR, folderName);

    console.log(`   - Folder: ${folderName}`);

    if (!DRY_RUN) {
      ensureDirectoryExists(folderPath);
    } else {
      console.log(`   [DRY-RUN] Would create: ${folderPath}`);
    }

    for (const snapshot of entry.snapshots) {
      const oldPath = path.join(COMPONENTS_DIR, snapshot.file);

      // Extract timestamp from old filename
      const match = snapshot.file.match(/_(\d+)\.json$/);
      if (!match) {
        console.log(`   ❌ Cannot parse filename: ${snapshot.file}`);
        errors.push(`Cannot parse: ${snapshot.file}`);
        continue;
      }

      const [, timestamp] = match;
      const newFilename = `${timestamp}.json`;
      const newPath = path.join(folderPath, newFilename);

      if (!fs.existsSync(oldPath)) {
        console.log(`   ❌ File not found: ${oldPath}`);
        errors.push(`Missing: ${oldPath}`);
        continue;
      }

      // Verify checksum
      const snapshotData = JSON.parse(fs.readFileSync(oldPath, "utf-8"));
      const actualChecksum = calculateChecksum(snapshotData);
      const expectedChecksum = snapshot.checksum.replace('sha256:', '');

      if (actualChecksum !== expectedChecksum) {
        console.log(`   ❌ Checksum mismatch for ${snapshot.file}`);
        errors.push(`Checksum mismatch: ${snapshot.file}`);
        continue;
      }

      if (!DRY_RUN) {
        fs.copyFileSync(oldPath, newPath);
      }

      snapshot.file = `${folderName}/${newFilename}`;
      migratedSnapshots++;
    }

    console.log(`   ✅ Migrated ${entry.snapshots.length} snapshots`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    console.log(`\n   ✅ Component index updated`);
  } else {
    console.log(`\n   [DRY-RUN] Would update index.json`);
  }

  return { total: totalSnapshots, migrated: migratedSnapshots, errors };
}

async function main() {
  console.log(`\n🔄 Flows & Components Migration: Flat → Folder Structure`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (preview only)' : 'EXECUTE (making changes)'}\n`);

  const flowsResult = await migrateFlows();
  const componentsResult = await migrateComponents();

  const allErrors = [...flowsResult.errors, ...componentsResult.errors];

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${DRY_RUN ? '📋 DRY-RUN SUMMARY' : '✅ MIGRATION COMPLETE'}`);
  console.log(`\n   Flows:`);
  console.log(`   - Total snapshots: ${flowsResult.total}`);
  console.log(`   - Migrated: ${flowsResult.migrated}`);
  console.log(`   - Errors: ${flowsResult.errors.length}`);
  console.log(`\n   Components:`);
  console.log(`   - Total snapshots: ${componentsResult.total}`);
  console.log(`   - Migrated: ${componentsResult.migrated}`);
  console.log(`   - Errors: ${componentsResult.errors.length}`);

  if (allErrors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    allErrors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
    if (allErrors.length > 10) {
      console.log(`   ... and ${allErrors.length - 10} more`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n💡 To execute migration, run:`);
    console.log(`   npm run migrate-flows-components -- --execute`);
  } else {
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run verification: npm run verify-migration`);
    console.log(`   2. Test rollback: npm run rollback -- --type flow --id <id> --list`);
    console.log(`   3. Commit changes: git add snapshots/ && git commit`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  process.exit(allErrors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
