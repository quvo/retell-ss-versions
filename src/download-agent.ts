/**
 * Download existing agent and conversation flow data
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

async function downloadAgent(agentId: string) {
  try {
    console.log(`Fetching agent: ${agentId}...`);

    // Get agent details
    const agent = await client.agent.retrieve(agentId);
    console.log(`✓ Agent retrieved: ${agent.agent_name}`);

    // Save agent data
    const agentFile = path.join(process.cwd(), `agent_${agentId}.json`);
    fs.writeFileSync(agentFile, JSON.stringify(agent, null, 2));
    console.log(`✓ Agent data saved to: ${agentFile}`);

    // Check if agent has conversation flow
    if (agent.response_engine?.type === 'conversation-flow') {
      const flowId = (agent.response_engine as any).conversation_flow_id;
      console.log(`\nFetching conversation flow: ${flowId}...`);

      const flow = await client.conversationFlow.retrieve(flowId);
      console.log(`✓ Conversation Flow retrieved (version ${flow.version})`);

      // Save conversation flow data
      const flowFile = path.join(process.cwd(), `conversation_flow_${flowId}.json`);
      fs.writeFileSync(flowFile, JSON.stringify(flow, null, 2));
      console.log(`✓ Conversation Flow saved to: ${flowFile}`);

      // Print summary
      console.log(`\n═══════════════════════════════════════════════════`);
      console.log(`  Summary`);
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`  Agent Name          : ${agent.agent_name}`);
      console.log(`  Agent ID            : ${agent.agent_id}`);
      console.log(`  Voice ID            : ${agent.voice_id}`);
      console.log(`  Language            : ${agent.language}`);
      console.log(`  Conversation Flow ID: ${flowId}`);
      console.log(`  Number of Nodes     : ${flow.nodes?.length || 0}`);
      console.log(`  Start Node          : ${flow.start_node_id}`);
      console.log(`  Start Speaker       : ${flow.start_speaker}`);
      console.log(`═══════════════════════════════════════════════════`);

      // Print node list
      if (flow.nodes && flow.nodes.length > 0) {
        console.log(`\n  Nodes:`);
        flow.nodes.forEach((node: any, index: number) => {
          const nodeName = node.name || node.id;
          console.log(`    ${index + 1}. [${node.type}] ${nodeName} (id: ${node.id})`);
        });
      }

      // Print tools
      if (flow.tools && flow.tools.length > 0) {
        console.log(`\n  Tools:`);
        flow.tools.forEach((tool: any, index: number) => {
          console.log(`    ${index + 1}. [${tool.type}] ${tool.name || tool.tool_id}`);
        });
      }

    } else {
      console.log(`\nAgent uses response engine type: ${agent.response_engine?.type}`);
    }

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    if (error.status === 404) {
      console.error(`Agent with ID "${agentId}" not found.`);
    }
    process.exit(1);
  }
}

// Get agent ID from command line argument or use default
const agentId = process.argv[2] || "agent_6cced6aca0ff4d77c7c7fd2e9a";

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  Retell Agent & Conversation Flow Downloader    ║");
console.log("╚══════════════════════════════════════════════════╝\n");

downloadAgent(agentId);
