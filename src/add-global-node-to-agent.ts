/**
 * Add Emergency Detection Component as Global Node to an agent's conversation flow
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
 * Load global_node_setting from JSON file
 */
function loadGlobalNodeSetting(jsonPath: string): any {
  const content = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  return content.global_node_setting;
}

/**
 * Add global node to agent's conversation flow
 */
async function addGlobalNodeToAgent(
  agentId: string,
  globalNodeSettingPath: string,
  dryRun: boolean = true
) {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Add Global Node to Agent Conversation Flow    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    // 1. Load global_node_setting and component from file
    console.log(`📄 Loading emergency component from: ${globalNodeSettingPath}`);
    const fileContent = JSON.parse(fs.readFileSync(globalNodeSettingPath, "utf-8"));
    const component = fileContent.component;
    const globalNodeSetting = fileContent.global_node_setting;

    console.log(`✅ Emergency component loaded`);
    console.log(`   Component ID: ${component.conversation_flow_component_id}`);
    console.log(`   Component Name: ${component.name}`);
    console.log(`   Component Nodes: ${component.nodes?.length || 0}`);
    console.log(`   Finetune examples: ${globalNodeSetting.positive_finetune_examples?.[0]?.transcript?.length || 0}\n`);

    // 2. Get current agent
    console.log(`🔍 Fetching agent: ${agentId}`);
    const agent = await client.agent.retrieve(agentId);

    // @ts-ignore
    console.log(`✅ Agent found: ${agent.agent_name || 'N/A'}`);
    // @ts-ignore
    const currentFlowId = agent.response_engine?.conversation_flow_id;

    if (!currentFlowId) {
      throw new Error("Agent does not have a conversation flow configured");
    }

    console.log(`   Current Flow ID: ${currentFlowId}\n`);

    // 3. Get current conversation flow
    console.log(`🔍 Fetching conversation flow: ${currentFlowId}`);
    const flow = await client.conversationFlow.retrieve(currentFlowId);

    // @ts-ignore
    console.log(`✅ Flow retrieved: ${flow.nodes?.length || 0} nodes`);
    // @ts-ignore
    const currentComponents = flow.components?.length || 0;
    console.log(`   Current components: ${currentComponents}\n`);

    // 4. Check if component already exists
    // @ts-ignore
    const existingComponent = flow.components?.find(
      (comp: any) => comp.conversation_flow_component_id === component.conversation_flow_component_id
    );

    if (existingComponent) {
      console.log("⚠️  Component with this ID already exists!");
      console.log("   Existing component will be replaced.\n");
    }

    // 5. Add or update component as global node
    // In Retell SDK v5, global nodes are components with begin_tag_display_position set
    const globalComponent = {
      ...component,
      begin_tag_display_position: {
        x: -200,  // Position on canvas
        y: 150
      },
      // Add flex_mode if not present
      flex_mode: component.flex_mode ?? false,
    };

    // @ts-ignore
    const updatedComponents = flow.components
      ? [
          // @ts-ignore
          ...flow.components.filter(
            (comp: any) => comp.conversation_flow_component_id !== component.conversation_flow_component_id
          ),
          globalComponent,
        ]
      : [globalComponent];

    console.log(`📝 New component count: ${updatedComponents.length}\n`);

    // 6. Save backup
    const backupPath = `flow_backup_${currentFlowId}_${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(flow, null, 2));
    console.log(`💾 Flow backup saved to: ${backupPath}\n`);

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made");
      console.log("\nProposed changes:");
      console.log(`  Flow ID: ${currentFlowId}`);
      console.log(`  Current components: ${currentComponents}`);
      console.log(`  New components: ${updatedComponents.length}`);
      console.log(`  Component to add: ${component.conversation_flow_component_id}`);
      console.log(`  Component name: ${component.name}`);
      console.log("\nTo apply changes, run with --execute flag\n");

      // Save proposed update to file
      const proposedPath = `flow_proposed_${currentFlowId}_${Date.now()}.json`;
      const proposedFlow = {
        // @ts-ignore
        ...flow,
        components: updatedComponents,
      };
      fs.writeFileSync(proposedPath, JSON.stringify(proposedFlow, null, 2));
      console.log(`💾 Proposed flow saved to: ${proposedPath}\n`);
      return;
    }

    // 7. Update conversation flow
    console.log("⬆️  Updating conversation flow...");
    const updatedFlow = await client.conversationFlow.update(currentFlowId, {
      // @ts-ignore
      nodes: flow.nodes,
      // @ts-ignore
      start_node_id: flow.start_node_id,
      components: updatedComponents,
      // @ts-ignore
      default_dynamic_variables: flow.default_dynamic_variables || {},
      // @ts-ignore
      tools: flow.tools || [],
    });

    console.log("✅ Conversation flow successfully updated!\n");

    console.log("═══════════════════════════════════════════════════");
    console.log("Summary:");
    console.log(`  Agent ID: ${agentId}`);
    // @ts-ignore
    console.log(`  Agent Name: ${agent.agent_name || 'N/A'}`);
    console.log(`  Flow ID: ${currentFlowId}`);
    console.log(`  Components: ${currentComponents} → ${updatedComponents.length}`);
    console.log(`  Added component: ${component.conversation_flow_component_id}`);
    console.log(`  Component name: ${component.name}`);
    console.log("═══════════════════════════════════════════════════\n");

    // 8. Verify update
    console.log("🔍 Verifying update...");
    const verifiedFlow = await client.conversationFlow.retrieve(currentFlowId);
    // @ts-ignore
    const verifiedComponents = verifiedFlow.components?.length || 0;

    if (verifiedComponents === updatedComponents.length) {
      console.log("✅ Verification successful - Component count matches\n");
    } else {
      console.log(`⚠️  Warning: Component count doesn't match (got: ${verifiedComponents})\n`);
    }

    // Save updated flow
    const outputPath = `flow_updated_${currentFlowId}_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(verifiedFlow, null, 2));
    console.log(`💾 Updated flow saved to: ${outputPath}\n`);

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

const agentId = args[0];
const globalNodeSettingPath = args[1];
const executeFlag = args.includes("--execute");
const dryRun = !executeFlag;

if (!agentId || !globalNodeSettingPath) {
  console.log("Usage:");
  console.log("  npm run add-global-node <agent-id> <global-node-json-path> [--execute]");
  console.log("\nExample (dry-run, preview changes):");
  console.log('  npm run add-global-node agent_7130415a405c1b3d53782ebc3c emergency_component_1776275287223.json');
  console.log("\nExample (execute):");
  console.log('  npm run add-global-node agent_7130415a405c1b3d53782ebc3c emergency_component_1776275287223.json --execute');
  console.log("\nThis script will:");
  console.log("  1. Load the global_node_setting from the JSON file");
  console.log("  2. Get the agent's current conversation flow");
  console.log("  3. Add (or update) the global node in the flow's global_node_settings");
  console.log("  4. Update the conversation flow via Retell API");
  process.exit(1);
}

addGlobalNodeToAgent(agentId, globalNodeSettingPath, dryRun);
