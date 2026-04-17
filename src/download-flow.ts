/**
 * Download a conversation flow
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

async function downloadFlow(flowId: string, outputPath?: string) {
  console.log(`🔍 Downloading flow: ${flowId}\n`);

  try {
    const flow = await client.conversationFlow.retrieve(flowId);

    // Determine output path
    const fileName = outputPath || `flow_${flowId}.json`;

    // Save to file
    fs.writeFileSync(fileName, JSON.stringify(flow, null, 2));

    console.log(`✅ Flow downloaded successfully!`);
    console.log(`📁 Saved to: ${fileName}\n`);

    // @ts-ignore
    if (flow.nodes) {
      // @ts-ignore
      console.log(`📊 Flow has ${flow.nodes.length} nodes`);

      // Find component nodes
      // @ts-ignore
      const componentNodes = flow.nodes.filter((n: any) => n.type === "component");
      if (componentNodes.length > 0) {
        console.log(`\n🔗 Component nodes (${componentNodes.length}):`);
        componentNodes.forEach((node: any) => {
          console.log(`   - ${node.name || node.id}`);
          if (node.conversation_flow_component_id) {
            console.log(`     Component ID: ${node.conversation_flow_component_id}`);
          }
        });
      }
    }

    return flow;
  } catch (error: any) {
    console.error(`❌ Error downloading flow: ${error.message}`);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const flowId = args[0];
const outputPath = args[1];

if (!flowId) {
  console.log("Usage:");
  console.log("  npm run download-flow <flow-id> [output-path]");
  console.log("\nExample:");
  console.log("  npm run download-flow conversation_flow_7ae57fcd806a flow.json");
  process.exit(1);
}

downloadFlow(flowId, outputPath);
