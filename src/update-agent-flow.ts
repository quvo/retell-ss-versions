/**
 * Update agent to use a specific conversation flow
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

async function updateAgentFlow(
  agentId: string,
  conversationFlowId: string,
  dryRun: boolean = false
) {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        Update Agent Conversation Flow           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    // 1. Get current agent
    console.log(`🔍 Fetching agent: ${agentId}`);
    const agent = await client.agent.retrieve(agentId);

    console.log(`✅ Agent found:`);
    // @ts-ignore
    console.log(`   Name: ${agent.agent_name || 'N/A'}`);
    // @ts-ignore
    const currentFlowId = agent.response_engine?.conversation_flow_id || 'None';
    console.log(`   Current Flow ID: ${currentFlowId}`);
    // @ts-ignore
    console.log(`   Voice: ${agent.voice_id}`);
    // @ts-ignore
    console.log(`   Response Engine: ${agent.response_engine?.type || 'N/A'}\n`);

    // 2. Verify conversation flow exists
    console.log(`🔍 Verifying conversation flow: ${conversationFlowId}`);
    const flow = await client.conversationFlow.retrieve(conversationFlowId);
    // @ts-ignore
    console.log(`✅ Conversation flow found (${flow.nodes?.length || 0} nodes)\n`);

    // 3. Save current state (for backup)
    const backupPath = `agent_backup_${agentId}_${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(agent, null, 2));
    console.log(`💾 Agent backup saved to: ${backupPath}\n`);

    // 4. Confirm before proceeding (unless "confirm" is passed as third argument)
    const forceUpdate = confirmFlag === "confirm";
    // @ts-ignore
    const oldFlowId = agent.response_engine?.conversation_flow_id || 'None';

    if (!forceUpdate) {
      console.log("⚠️  CONFIRMATION REQUIRED");
      console.log(`   Agent: ${agentId}`);
      console.log(`   Old Flow: ${oldFlowId}`);
      console.log(`   New Flow: ${conversationFlowId}`);
      console.log(`\n   To proceed, re-run with "confirm" argument:`);
      console.log(`   npm run update-agent-flow ${agentId} ${conversationFlowId} confirm\n`);
      return;
    }

    // 5. Update agent
    console.log("⬆️  Updating agent (confirmed)...");
    const updatedAgent = await client.agent.update(agentId, {
      response_engine: {
        type: "conversation-flow",
        conversation_flow_id: conversationFlowId,
      },
    });

    console.log("✅ Agent successfully updated!\n");

    console.log("═══════════════════════════════════════════════════");
    console.log("Summary:");
    console.log(`  Agent ID: ${agentId}`);
    // @ts-ignore
    console.log(`  Agent Name: ${updatedAgent.agent_name || 'N/A'}`);
    console.log(`  Old Flow ID: ${oldFlowId}`);
    console.log(`  New Flow ID: ${conversationFlowId}`);
    console.log("═══════════════════════════════════════════════════\n");

    // 6. Verify update
    console.log("🔍 Verifying update...");
    const verifiedAgent = await client.agent.retrieve(agentId);
    // @ts-ignore
    const verifiedFlowId = verifiedAgent.response_engine?.conversation_flow_id;
    if (verifiedFlowId === conversationFlowId) {
      console.log("✅ Verification successful - Flow ID matches\n");
    } else {
      console.log(`⚠️  Warning: Flow ID doesn't match (got: ${verifiedFlowId})\n`);
    }

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

// Filter out flags
const nonFlagArgs = args.filter((arg) => !arg.startsWith("--"));
const agentId = nonFlagArgs[0];
const conversationFlowId = nonFlagArgs[1];
const confirmFlag = nonFlagArgs[2]; // Use "confirm" as third positional argument
const dryRun = args.includes("--dry-run");

if (!agentId || !conversationFlowId) {
  console.log("Usage:");
  console.log("  npm run update-agent-flow <agent-id> <conversation-flow-id> [confirm]");
  console.log("\nExample (dry-run, shows what will happen):");
  console.log("  npm run update-agent-flow agent_7130415a405c1b3d53782ebc3c conversation_flow_7ae57fcd806a");
  console.log("\nExample (execute):");
  console.log("  npm run update-agent-flow agent_7130415a405c1b3d53782ebc3c conversation_flow_7ae57fcd806a confirm");
  process.exit(1);
}

updateAgentFlow(agentId, conversationFlowId, dryRun);
