/**
 * Check status of specific conversation flows
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

async function checkFlowStatus(flowId: string) {
  try {
    console.log(`\nChecking: ${flowId}`);
    const flow = await client.conversationFlow.retrieve(flowId);
    console.log(`  ✓ Found - Version: v${flow.version}, Nodes: ${flow.nodes?.length || 0}, Updated: ${new Date(flow.updated_at).toLocaleDateString()}`);
    return { flowId, exists: true, version: flow.version, nodes: flow.nodes?.length || 0, updatedAt: flow.updated_at };
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`  ✗ Not found (deleted or expired)`);
      return { flowId, exists: false };
    }
    console.log(`  ✗ Error: ${error.message}`);
    return { flowId, exists: false, error: error.message };
  }
}

async function checkFlows() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║      Checking Conversation Flow Status          ║");
  console.log("╚══════════════════════════════════════════════════╝");

  const flowIds = [
    "conversation_flow_91ba2cb61040",
    "conversation_flow_b17e58a95e61",
    "conversation_flow_be49eb8e4341",
  ];

  const results = [];
  for (const flowId of flowIds) {
    const result = await checkFlowStatus(flowId);
    results.push(result);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════");

  const existingFlows = results.filter(r => r.exists);
  console.log(`  Active flows: ${existingFlows.length}/${flowIds.length}`);

  if (existingFlows.length > 0) {
    console.log("\n  Available for snapshot:");
    existingFlows.forEach(flow => {
      console.log(`    - ${flow.flowId} (v${flow.version})`);
    });
  }
  console.log("═══════════════════════════════════════════════════\n");

  return existingFlows;
}

checkFlows();
