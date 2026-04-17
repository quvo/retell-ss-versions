/**
 * List all Retell AI resources (flows and agents)
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

async function listAllResources() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        Retell AI Resources - Current State      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    // List conversation flows
    const flowsResponse = await client.conversationFlow.list();
    const flows = flowsResponse.conversation_flows || [];

    console.log("=== CONVERSATION FLOWS ===\n");
    if (flows.length === 0) {
      console.log("  No conversation flows found\n");
    } else {
      flows.forEach((flow: any, index: number) => {
        console.log(`[FLOW-${index + 1}] ${flow.conversation_flow_id}`);
        console.log(`  Version     : v${flow.version}`);
        console.log(`  Updated     : ${new Date(flow.updated_at).toLocaleString()}`);
        if (flow.nodes) {
          console.log(`  Nodes       : ${flow.nodes.length}`);
        }
        if (flow.tools) {
          console.log(`  Tools       : ${flow.tools.length}`);
        }
        console.log();
      });
    }

    // List agents
    const agentsResponse = await client.agent.list();
    const agents = agentsResponse.agents || [];

    console.log("=== AGENTS ===\n");
    if (agents.length === 0) {
      console.log("  No agents found\n");
    } else {
      agents.forEach((agent: any, index: number) => {
        console.log(`[AGENT-${index + 1}] ${agent.agent_id}`);
        if (agent.agent_name) {
          console.log(`  Name        : ${agent.agent_name}`);
        }
        console.log(`  Voice       : ${agent.voice_id || "N/A"}`);
        console.log(`  Model       : ${agent.model_choice?.model || "N/A"}`);
        console.log(`  Updated     : ${new Date(agent.updated_at).toLocaleString()}`);
        console.log();
      });
    }

    console.log("═══════════════════════════════════════════════════");
    console.log(`Total: ${flows.length} flows, ${agents.length} agents`);
    console.log("═══════════════════════════════════════════════════\n");

    return { flows, agents };
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

listAllResources();
