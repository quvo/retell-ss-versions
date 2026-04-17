/**
 * Inspect conversation flow structure
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

async function inspectFlow(agentId: string) {
  try {
    console.log(`🔍 Fetching agent: ${agentId}`);
    const agent = await client.agent.retrieve(agentId);

    // @ts-ignore
    const flowId = agent.response_engine?.conversation_flow_id;
    console.log(`Flow ID: ${flowId}\n`);

    const flow = await client.conversationFlow.retrieve(flowId);

    console.log("Flow structure:");
    // @ts-ignore
    console.log(`  - nodes: ${flow.nodes?.length || 0}`);
    // @ts-ignore
    console.log(`  - components: ${flow.components?.length || 0}`);
    // @ts-ignore
    console.log(`  - tools: ${flow.tools?.length || 0}`);

    // @ts-ignore
    if (flow.components && flow.components.length > 0) {
      console.log("\nComponents structure:");
      // @ts-ignore
      flow.components.forEach((comp: any, index: number) => {
        console.log(`\n[${index}]:`);
        if (typeof comp === 'string') {
          console.log(`  Type: string (component_id)`);
          console.log(`  Value: ${comp}`);
        } else if (typeof comp === 'object') {
          console.log(`  Type: object`);
          console.log(`  Keys: ${Object.keys(comp).join(', ')}`);
          if (comp.component_id) {
            console.log(`  component_id: ${comp.component_id}`);
          }
          if (comp.condition) {
            console.log(`  condition: ${comp.condition.substring(0, 100)}...`);
          }
          if (comp.positive_finetune_examples) {
            console.log(`  positive_finetune_examples: ${comp.positive_finetune_examples.length} items`);
          }
        }
      });
    }

    // Save full flow for inspection
    const outputPath = `flow_inspect_${flowId}_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(flow, null, 2));
    console.log(`\n💾 Full flow saved to: ${outputPath}`);

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

const agentId = process.argv[2];

if (!agentId) {
  console.log("Usage: npm run inspect-flow <agent-id>");
  console.log("\nExample:");
  console.log("  npm run inspect-flow agent_e6cf0d7c969c505dc0354afac6");
  process.exit(1);
}

inspectFlow(agentId);
