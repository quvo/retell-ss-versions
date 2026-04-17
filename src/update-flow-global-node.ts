/**
 * Update a conversation flow's Emergency Detection global node settings
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

/**
 * Update Emergency Detection node in a conversation flow with new global_node_setting
 */
async function updateFlowGlobalNode(
  flowId: string,
  globalNodeSettingPath: string,
  dryRun: boolean = false
) {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Update Flow Emergency Detection Global Node   ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Load global_node_setting from file
  console.log(`📄 Loading global_node_setting from: ${globalNodeSettingPath}`);
  const fileContent = JSON.parse(fs.readFileSync(globalNodeSettingPath, "utf-8"));
  const globalNodeSetting = fileContent.global_node_setting;

  if (!globalNodeSetting) {
    console.error("❌ Error: No global_node_setting found in file");
    process.exit(1);
  }

  console.log(`✅ Loaded global_node_setting:`);
  console.log(`   Condition: ${globalNodeSetting.condition.substring(0, 80)}...`);
  console.log(`   Examples: ${globalNodeSetting.positive_finetune_examples.length}\n`);

  // 2. Download current flow
  console.log(`🔍 Downloading flow: ${flowId}`);
  const flow = await client.conversationFlow.retrieve(flowId);
  console.log(`✅ Flow downloaded\n`);

  // 3. Find Emergency Detection component node
  // @ts-ignore
  const emergencyNode = flow.nodes.find(
    (n: any) => n.name === "Emergency Detection" && n.type === "component"
  );

  if (!emergencyNode) {
    console.error("❌ Error: Could not find 'Emergency Detection' component node in flow");
    console.error("   Available component nodes:");
    // @ts-ignore
    flow.nodes
      .filter((n: any) => n.type === "component")
      .forEach((n: any) => {
        console.error(`   - ${n.name || n.id}`);
      });
    process.exit(1);
  }

  console.log(`🎯 Found Emergency Detection node: ${emergencyNode.id}`);
  console.log(`   Component ID: ${emergencyNode.component_id}\n`);

  // 4. Update global_node_setting
  const originalSetting = emergencyNode.global_node_setting || {};
  emergencyNode.global_node_setting = globalNodeSetting;

  console.log("📝 Updated global_node_setting:");
  console.log(`   Old examples: ${originalSetting.positive_finetune_examples?.length || 0}`);
  console.log(`   New examples: ${globalNodeSetting.positive_finetune_examples.length}\n`);

  // 5. Save to file (for review)
  const outputPath = path.join(process.cwd(), `flow_updated_${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(flow, null, 2));
  console.log(`💾 Updated flow saved to: ${outputPath}\n`);

  // Confirm before proceeding (unless --force flag)
  const forceUpdate = process.argv.includes("--force");

  if (!forceUpdate) {
    console.log("⚠️  CONFIRMATION REQUIRED");
    console.log(`   Flow: ${flowId}`);
    console.log(`   Old examples: ${originalSetting.positive_finetune_examples?.length || 0}`);
    console.log(`   New examples: ${globalNodeSetting.positive_finetune_examples.length}`);
    console.log(`\n   Preview saved to: ${outputPath}`);
    console.log(`\n   To upload changes, re-run with --force flag:`);
    console.log(`   npm run update-flow-global-node ${flowId} ${globalNodeSettingPath} --force\n`);
    return;
  }

  // 6. Upload to Retell
  console.log("⬆️  Uploading updated flow to Retell API with --force flag...");
  try {
    await client.conversationFlow.update(flowId, {
      // @ts-ignore
      nodes: flow.nodes,
      // @ts-ignore
      start_node_id: flow.start_node_id,
      // @ts-ignore
      tools: flow.tools || [],
      // @ts-ignore
      default_dynamic_variables: flow.default_dynamic_variables || [],
    });
    console.log("✅ Flow successfully updated!\n");

    console.log("═══════════════════════════════════════════════════");
    console.log("Summary:");
    console.log(`  Flow ID: ${flowId}`);
    console.log(`  Emergency Detection node updated`);
    console.log(`  Finetune examples: ${globalNodeSetting.positive_finetune_examples.length}`);
    console.log("═══════════════════════════════════════════════════\n");
  } catch (error: any) {
    console.error("❌ Error uploading flow:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

// Filter out flags
const nonFlagArgs = args.filter((arg) => !arg.startsWith("--"));
const flowId = nonFlagArgs[0];
const globalNodeSettingPath = nonFlagArgs[1];
const dryRun = args.includes("--dry-run");

if (!flowId || !globalNodeSettingPath) {
  console.log("Usage:");
  console.log("  npm run update-flow-global-node <flow-id> <global-node-setting-json> [--force]");
  console.log("\nExample (dry-run, preview changes):");
  console.log(
    '  npm run update-flow-global-node conversation_flow_7ae57fcd806a emergency_global_node_updated_*.json'
  );
  console.log("\nExample (execute):");
  console.log(
    '  npm run update-flow-global-node conversation_flow_7ae57fcd806a emergency_global_node_updated_*.json --force'
  );
  process.exit(1);
}

updateFlowGlobalNode(flowId, globalNodeSettingPath, dryRun);
