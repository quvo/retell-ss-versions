/**
 * Download a specific version of conversation flow
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

async function downloadFlowVersion(flowId: string, version: number) {
  try {
    console.log(`Fetching conversation flow: ${flowId} (version ${version})...`);

    const flow = await client.conversationFlow.retrieve(flowId, { version });
    console.log(`✓ Conversation Flow retrieved (version ${flow.version})`);

    // Save conversation flow data
    const flowFile = path.join(process.cwd(), `conversation_flow_${flowId}.json`);
    fs.writeFileSync(flowFile, JSON.stringify(flow, null, 2));
    console.log(`✓ Conversation Flow saved to: ${flowFile}`);

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  Summary`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`  Flow ID            : ${flowId}`);
    console.log(`  Version            : ${flow.version}`);
    console.log(`  Number of Nodes    : ${flow.nodes?.length || 0}`);
    console.log(`  Start Node         : ${flow.start_node_id}`);
    console.log(`═══════════════════════════════════════════════════`);

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (error.status === 404) {
      console.error(`Flow "${flowId}" version ${version} not found.`);
    }
    process.exit(1);
  }
}

// Get flow ID and version from command line arguments
const flowId = process.argv[2] || "conversation_flow_b17e58a95e61";
const version = parseInt(process.argv[3] || "4", 10);

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Retell Conversation Flow Version Downloader    ║");
console.log("╚══════════════════════════════════════════════════╝\n");

downloadFlowVersion(flowId, version);
