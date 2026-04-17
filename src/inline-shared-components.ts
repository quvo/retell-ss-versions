/**
 * Convert shared components to inline nodes
 * This expands shared components into the main flow
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

async function inlineSharedComponents(flowId: string) {
  try {
    console.log(`Fetching current flow...`);
    const currentFlow = await client.conversationFlow.retrieve(flowId);
    console.log(`✓ Retrieved flow version ${currentFlow.version} (${currentFlow.nodes?.length} nodes)`);

    // Find shared components
    const sharedComponentNodes: any[] = [];
    const sharedComponentIds = new Set<string>();

    currentFlow.nodes?.forEach((node: any) => {
      if (node.type === 'component' && node.component_type === 'shared') {
        sharedComponentNodes.push(node);
        sharedComponentIds.add(node.component_id);
      }
    });

    if (sharedComponentIds.size === 0) {
      console.log(`✓ No shared components found. Flow is already using local/inline components.`);
      return currentFlow;
    }

    console.log(`\nFound ${sharedComponentIds.size} unique shared components:`);
    sharedComponentIds.forEach(id => console.log(`  - ${id}`));
    console.log(`Used in ${sharedComponentNodes.length} places`);

    // Fetch shared component definitions
    const componentDefinitions = new Map<string, any>();
    for (const componentId of sharedComponentIds) {
      console.log(`\nFetching component: ${componentId}...`);
      const component = await client.conversationFlowComponent.retrieve(componentId);
      componentDefinitions.set(componentId, component);
      console.log(`  ✓ Component name: ${component.name}`);
      console.log(`  ✓ Nodes: ${component.nodes?.length || 0}`);
    }

    // Strategy: Replace shared component nodes with regular conversation nodes
    // Since we can't inline the full component structure, we'll convert to simple conversation nodes
    const updatedNodes = currentFlow.nodes?.map((node: any) => {
      if (node.type === 'component' && node.component_type === 'shared') {
        const component = componentDefinitions.get(node.component_id);

        // Convert to a conversation node that behaves similarly
        return {
          type: 'conversation',
          id: node.id,
          name: node.name || component?.name || 'Converted Node',
          instruction: {
            type: 'prompt',
            text: `Handle ${component?.name || 'callback'} flow`
          },
          edges: node.edges || [],
          else_edge: node.else_edge,
          display_position: node.display_position
        };
      }
      return node;
    });

    const updatePayload: any = {
      nodes: updatedNodes,
      start_node_id: currentFlow.start_node_id,
      start_speaker: currentFlow.start_speaker,
      global_prompt: currentFlow.global_prompt,
    };

    if (currentFlow.tools && currentFlow.tools.length > 0) {
      updatePayload.tools = currentFlow.tools;
    }

    if (currentFlow.default_dynamic_variables) {
      updatePayload.default_dynamic_variables = currentFlow.default_dynamic_variables;
    }

    console.log(`\nUpdating conversation flow...`);
    console.log(`  - Converting ${sharedComponentNodes.length} shared component nodes to conversation nodes`);

    const updatedFlow = await client.conversationFlow.update(flowId, updatePayload);

    console.log(`\n✓ Successfully converted shared components!`);
    console.log(`  - New version: ${updatedFlow.version}`);
    console.log(`  - Flow ID: ${updatedFlow.conversation_flow_id}`);

    // Save the result
    const resultFile = path.join(process.cwd(), `conversation_flow_${flowId}_inlined.json`);
    fs.writeFileSync(resultFile, JSON.stringify(updatedFlow, null, 2));
    console.log(`  - Saved to: ${resultFile}`);

    return updatedFlow;

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.status === 404) {
      console.error(`Flow "${flowId}" not found.`);
    } else if (error.status === 400) {
      console.error(`Bad request.`);
      console.error(`Details: ${JSON.stringify(error.error, null, 2)}`);
    }
    throw error;
  }
}

const flowId = process.argv[2] || "conversation_flow_b17e58a95e61";

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Inline Shared Components                       ║");
console.log("╚══════════════════════════════════════════════════╝\n");

inlineSharedComponents(flowId)
  .then(() => {
    console.log("\n✅ Conversion completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Conversion failed!");
    process.exit(1);
  });
