/**
 * Retell AI Rollback Tool
 * Rollback single agent/flow/component to a specific version
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { RollbackOptions, RollbackResult, AuditLogEntry, IndexData } from "./types/rollback-types.js";
import { preValidateRollback, postValidateRollback, calculateChecksum } from "./validation.js";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({
  apiKey: RETELL_API_KEY,
});

function parseArgs(): RollbackOptions {
  const args = process.argv.slice(2);
  const options: RollbackOptions = {
    resourceType: 'agent',
    resourceId: '',
    dryRun: true,
    autoPublish: true,
    listVersions: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--type':
        const type = args[++i];
        if (type !== 'agent' && type !== 'flow' && type !== 'component') {
          console.error(`Invalid type: ${type}. Must be agent, flow, or component.`);
          process.exit(1);
        }
        options.resourceType = type;
        break;
      case '--id':
        options.resourceId = args[++i];
        break;
      case '--version':
        options.targetVersion = parseInt(args[++i], 10);
        break;
      case '--timestamp':
        options.targetTimestamp = args[++i];
        break;
      case '--execute':
        options.dryRun = false;
        break;
      case '--no-publish':
        options.autoPublish = false;
        break;
      case '--list':
        options.listVersions = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

function shortId(fullId: string): string {
  return fullId.replace(/^(conversation_flow_|agent_|conversation_flow_component_)/, "");
}

function listVersions(resourceType: string, resourceId: string): void {
  const indexPath = `snapshots/${resourceType}s/index.json`;
  if (!fs.existsSync(indexPath)) {
    console.error(`Index file not found: ${indexPath}`);
    process.exit(1);
  }

  const indexData: IndexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const fullResourceId = resourceType === 'flow'
    ? `conversation_flow_${resourceId}`
    : resourceType === 'agent'
    ? `agent_${resourceId}`
    : `conversation_flow_component_${resourceId}`;

  if (!indexData[fullResourceId]) {
    console.error(`Resource ${resourceId} not found in index`);
    process.exit(1);
  }

  const entry = indexData[fullResourceId];
  console.log(`\n📋 Available versions for ${resourceType} ${resourceId}:`);
  console.log(`   Current version: ${entry.current_version || 'N/A'}\n`);

  entry.snapshots.forEach((snapshot, index) => {
    const version = snapshot.version !== undefined ? `v${snapshot.version}` : `#${index + 1}`;
    const timestamp = new Date(snapshot.timestamp).toLocaleString();
    const checksum = snapshot.checksum.substring(0, 16) + '...';
    console.log(`   ${version.padEnd(6)} ${timestamp.padEnd(25)} ${checksum}`);
  });

  console.log('');
  process.exit(0);
}

function showDiff(current: any, target: any, resourceType: string): string[] {
  const changes: string[] = [];

  // Compare key fields
  const fieldsToCompare = resourceType === 'agent'
    ? ['agent_name', 'voice_id', 'response_engine', 'webhook_url', 'language', 'ambient_sound']
    : resourceType === 'flow'
    ? ['conversation_flow_name', 'nodes', 'edges', 'tools']
    : ['name', 'nodes', 'edges'];

  for (const field of fieldsToCompare) {
    const currentVal = JSON.stringify(current[field]);
    const targetVal = JSON.stringify(target[field]);

    if (currentVal !== targetVal) {
      if (field === 'nodes' || field === 'edges' || field === 'tools') {
        const currentCount = current[field]?.length || 0;
        const targetCount = target[field]?.length || 0;
        changes.push(`  ${field}: ${currentCount} items -> ${targetCount} items`);
      } else {
        const preview = (val: string) => val.length > 50 ? val.substring(0, 47) + '...' : val;
        changes.push(`  ${field}: ${preview(currentVal)} -> ${preview(targetVal)}`);
      }
    }
  }

  return changes;
}

async function executeRollback(options: RollbackOptions): Promise<RollbackResult> {
  const result: RollbackResult = {
    success: false,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    changes: [],
    errors: [],
    timestamp: new Date().toISOString(),
    dryRun: options.dryRun,
  };

  console.log(`\n🔄 ${options.dryRun ? 'DRY RUN: ' : ''}Rollback ${options.resourceType} ${options.resourceId}`);
  console.log(`   Target: ${options.targetVersion !== undefined ? `v${options.targetVersion}` : options.targetTimestamp}\n`);

  // Pre-validation
  console.log("1️⃣  Pre-validation...");
  const validation = await preValidateRollback(
    options.resourceType,
    options.resourceId,
    options.targetVersion,
    options.targetTimestamp,
    client
  );

  if (!validation.valid) {
    result.errors = validation.errors;
    validation.errors.forEach(err => console.error(`   ❌ ${err}`));
    return result;
  }
  console.log("   ✅ All checks passed\n");

  // Show diff
  console.log("2️⃣  Changes to apply:");
  const changes = showDiff(validation.currentData, validation.snapshotData, options.resourceType);
  if (changes.length === 0) {
    console.log("   ℹ️  No changes detected (already at target state)");
  } else {
    changes.forEach(change => console.log(change));
  }
  result.changes = changes;
  console.log('');

  result.oldVersion = validation.currentData?.version;

  // Execute rollback (if not dry-run)
  if (!options.dryRun) {
    console.log("3️⃣  Executing rollback...");

    try {
      // Prepare update params (exclude read-only fields)
      const {
        agent_id,
        conversation_flow_id,
        conversation_flow_component_id,
        version,
        created_at,
        updated_at,
        last_modification_timestamp,
        ...updateParams
      } = validation.snapshotData;

      const fullResourceId = options.resourceType === 'flow'
        ? `conversation_flow_${options.resourceId}`
        : options.resourceType === 'agent'
        ? `agent_${options.resourceId}`
        : `conversation_flow_component_${options.resourceId}`;

      // Execute update
      if (options.resourceType === 'agent') {
        await client.agent.update(fullResourceId, updateParams);
        console.log("   ✅ Agent updated");

        if (options.autoPublish) {
          await client.agent.publish(fullResourceId);
          console.log("   ✅ Agent published");
        }
      } else if (options.resourceType === 'flow') {
        await client.conversationFlow.update(fullResourceId, updateParams);
        console.log("   ✅ Flow updated");
      } else {
        await client.conversationFlowComponent.update(fullResourceId, updateParams);
        console.log("   ✅ Component updated");
      }

      // Post-validation
      console.log("\n4️⃣  Post-validation...");
      const postValidation = await postValidateRollback(
        options.resourceType,
        options.resourceId,
        validation.snapshotData,
        client
      );

      if (!postValidation.valid) {
        result.errors = postValidation.errors;
        postValidation.errors.forEach(err => console.error(`   ❌ ${err}`));
        return result;
      }

      if (postValidation.warnings.length > 0) {
        postValidation.warnings.forEach(warn => console.warn(`   ⚠️  ${warn}`));
      }

      console.log("   ✅ Rollback verified\n");

      // Get new version
      let newData: any;
      if (options.resourceType === 'agent') {
        newData = await client.agent.retrieve(fullResourceId);
      } else if (options.resourceType === 'flow') {
        newData = await client.conversationFlow.retrieve(fullResourceId);
      }
      result.newVersion = newData?.version;

      result.success = true;
    } catch (error: any) {
      result.errors?.push(`Rollback execution failed: ${error.message}`);
      console.error(`   ❌ ${error.message}\n`);
      return result;
    }
  } else {
    console.log("3️⃣  Skipped (dry-run mode)\n");
    result.success = true;
  }

  return result;
}

function writeAuditLog(options: RollbackOptions, result: RollbackResult): void {
  const auditEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    action: 'rollback',
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    fromVersion: result.oldVersion,
    toVersion: options.targetVersion || 0,
    executedBy: process.env.USER || 'unknown',
    dryRun: options.dryRun,
    success: result.success,
    errors: result.errors,
  };

  const logLine = JSON.stringify(auditEntry) + '\n';
  fs.appendFileSync('rollback-audit.jsonl', logLine);
}

async function main() {
  const options = parseArgs();

  // Validate required arguments
  if (!options.resourceId) {
    console.error("Error: --id is required");
    console.error("\nUsage:");
    console.error("  npm run rollback -- --type agent --id <id> --version <version> [--execute]");
    console.error("  npm run rollback -- --type agent --id <id> --list");
    process.exit(1);
  }

  // List versions if requested
  if (options.listVersions) {
    listVersions(options.resourceType, options.resourceId);
    return;
  }

  // Validate target version/timestamp
  if (options.resourceType === 'component' && !options.targetTimestamp) {
    console.error("Error: --timestamp is required for components");
    process.exit(1);
  }
  if (options.resourceType !== 'component' && options.targetVersion === undefined) {
    console.error("Error: --version is required for agents and flows");
    process.exit(1);
  }

  // Execute rollback
  const result = await executeRollback(options);

  // Write audit log
  writeAuditLog(options, result);

  // Print summary
  console.log("━".repeat(60));
  if (result.success) {
    console.log("✅ ROLLBACK SUCCESSFUL");
    if (options.dryRun) {
      console.log("\nℹ️  This was a dry-run. No changes were made.");
      console.log("   Add --execute flag to apply changes.");
    } else {
      console.log(`\n   ${options.resourceType} ${options.resourceId}`);
      if (result.oldVersion !== undefined && result.newVersion !== undefined) {
        console.log(`   Version: v${result.oldVersion} -> v${result.newVersion}`);
      }
      console.log(`   Changes applied: ${result.changes.length}`);
    }
  } else {
    console.log("❌ ROLLBACK FAILED");
    result.errors?.forEach(err => console.error(`   ${err}`));
  }
  console.log("━".repeat(60));

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
