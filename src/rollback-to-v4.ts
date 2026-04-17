/**
 * Rollback conversation flow from v5 to v4
 * Converts shared components back to local components
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

async function rollbackToV4(flowId: string) {
  try {
    console.log(`Fetching v4 and v5 for comparison...`);

    // Get v4 and v5
    const v4 = await client.conversationFlow.retrieve(flowId, { version: 4 });
    const v5 = await client.conversationFlow.retrieve(flowId, { version: 5 });

    console.log(`✓ Retrieved v4 (${v4.nodes?.length} nodes)`);
    console.log(`✓ Retrieved v5 (${v5.nodes?.length} nodes)`);

    // Find shared components in v5
    const sharedComponentIds = new Set<string>();
    v5.nodes?.forEach((node: any) => {
      if (node.type === 'component' && node.component_type === 'shared') {
        sharedComponentIds.add(node.component_id);
      }
    });

    console.log(`\nFound ${sharedComponentIds.size} unique shared components in v5:`);
    sharedComponentIds.forEach(id => console.log(`  - ${id}`));

    // Fetch shared component definitions
    const componentDefinitions = new Map<string, any>();
    for (const componentId of sharedComponentIds) {
      console.log(`\nFetching component: ${componentId}...`);
      const component = await client.conversationFlowComponent.retrieve(componentId);
      componentDefinitions.set(componentId, component);
      console.log(`  ✓ Component name: ${component.name}`);
      console.log(`  ✓ Nodes: ${component.nodes?.length || 0}`);
    }

    // Build update payload with v4 structure
    const updatePayload: any = {
      nodes: v4.nodes,
      start_node_id: v4.start_node_id,
      start_speaker: v4.start_speaker,
      global_prompt: v4.global_prompt,
    };

    if (v4.tools && v4.tools.length > 0) {
      updatePayload.tools = v4.tools;
    }

    if (v4.default_dynamic_variables) {
      updatePayload.default_dynamic_variables = v4.default_dynamic_variables;
    }

    console.log(`\nUpdating conversation flow to v4 structure...`);
    console.log(`  - Nodes: ${updatePayload.nodes?.length}`);
    console.log(`  - Tools: ${updatePayload.tools?.length || 0}`);

    const updatedFlow = await client.conversationFlow.update(flowId, updatePayload);

    console.log(`\n✓ Successfully rolled back to v4 structure!`);
    console.log(`  - New version: ${updatedFlow.version}`);
    console.log(`  - Flow ID: ${updatedFlow.conversation_flow_id}`);

    // Save the result
    const resultFile = path.join(process.cwd(), `conversation_flow_${flowId}_rollback.json`);
    fs.writeFileSync(resultFile, JSON.stringify(updatedFlow, null, 2));
    console.log(`  - Saved to: ${resultFile}`);

    return updatedFlow;

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.status === 404) {
      console.error(`Flow "${flowId}" not found.`);
    } else if (error.status === 400) {
      console.error(`Bad request - check the flow data format.`);
      console.error(`Details: ${JSON.stringify(error.error, null, 2)}`);
    }
    throw error;
  }
}

// Get flow ID from command line argument
const flowId = process.argv[2] || "conversation_flow_b17e58a95e61";

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Rollback Conversation Flow to V4               ║");
console.log("╚══════════════════════════════════════════════════╝\n");

rollbackToV4(flowId)
  .then(() => {
    console.log("\n✅ Rollback completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Rollback failed!");
    process.exit(1);
  });
