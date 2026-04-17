/**
 * Update existing conversation flow with local JSON file
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

async function updateConversationFlow(flowId: string, filePath: string) {
  try {
    console.log(`Reading conversation flow from: ${filePath}...`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const flowData = JSON.parse(fileContent);

    console.log(`✓ Loaded flow data (version ${flowData.version})`);
    console.log(`  - Flow ID: ${flowData.conversation_flow_id}`);
    console.log(`  - Nodes: ${flowData.nodes?.length || 0}`);
    console.log(`  - Tools: ${flowData.tools?.length || 0}`);

    console.log(`\nUpdating conversation flow ${flowId}...`);

    // Prepare update payload - exclude read-only fields
    const updatePayload: any = {
      nodes: flowData.nodes,
      start_node_id: flowData.start_node_id,
      start_speaker: flowData.start_speaker,
    };

    if (flowData.global_prompt) {
      updatePayload.global_prompt = flowData.global_prompt;
    }

    if (flowData.tools && flowData.tools.length > 0) {
      updatePayload.tools = flowData.tools;
    }

    if (flowData.default_dynamic_variables) {
      updatePayload.default_dynamic_variables = flowData.default_dynamic_variables;
    }

    const updatedFlow = await client.conversationFlow.update(flowId, updatePayload);

    console.log(`✓ Conversation Flow updated successfully!`);
    console.log(`  - New version: ${updatedFlow.version}`);
    console.log(`  - Flow ID: ${updatedFlow.conversation_flow_id}`);

    return updatedFlow;

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (error.status === 404) {
      console.error(`Flow "${flowId}" not found.`);
    } else if (error.status === 400) {
      console.error(`Bad request - check the flow data format.`);
      console.error(`Details: ${JSON.stringify(error.error, null, 2)}`);
    }
    process.exit(1);
  }
}

// Get flow ID and file path from command line arguments
const flowId = process.argv[2] || "conversation_flow_b17e58a95e61";
const filePath = process.argv[3] || path.join(process.cwd(), `conversation_flow_${flowId}.json`);

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Retell Conversation Flow Updater               ║");
console.log("╚══════════════════════════════════════════════════╝\n");

updateConversationFlow(flowId, filePath);
