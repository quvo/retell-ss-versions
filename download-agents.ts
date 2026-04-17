import Retell from "retell-sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RETELL_API_KEY = process.env.RETELL_API_KEY;
if (!RETELL_API_KEY) {
  throw new Error("RETELL_API_KEY not found in .env");
}

const client = new Retell({ apiKey: RETELL_API_KEY });

const AGENT_IDS = [
  "agent_7f9970d8ffabe265abbb553b56",
  "agent_b9906d5645dc6a62ec5b104846",
  "agent_a8ce7361527f616d5689b65567",
  "agent_8e05530ec88beade095fc11cb1",
];

async function downloadAgent(agentId: string) {
  console.log(`\n📥 Downloading agent: ${agentId}`);

  try {
    // Get agent details
    const agent = await client.agent.retrieve(agentId);
    console.log(`  ✓ Agent name: ${agent.agent_name || "Unnamed"}`);

    // Create output directory
    const outputDir = path.join(__dirname, "downloaded-agents", agentId);
    fs.mkdirSync(outputDir, { recursive: true });

    // Save agent configuration
    fs.writeFileSync(
      path.join(outputDir, "agent.json"),
      JSON.stringify(agent, null, 2)
    );
    console.log(`  ✓ Saved agent.json`);

    // Get conversation flow if it exists (check both direct and response_engine)
    let flowId = agent.conversation_flow_id;
    if (!flowId && agent.response_engine?.type === "conversation-flow") {
      flowId = (agent.response_engine as any).conversation_flow_id;
    }

    if (flowId) {
      console.log(`  📋 Fetching conversation flow: ${flowId}`);
      try {
        const flow = await client.conversationFlow.retrieve(flowId);

        fs.writeFileSync(
          path.join(outputDir, "conversation_flow.json"),
          JSON.stringify(flow, null, 2)
        );
        console.log(`  ✓ Saved conversation_flow.json (${flow.nodes?.length || 0} nodes)`);
      } catch (error: any) {
        console.error(`  ⚠️  Could not fetch flow: ${error.message}`);
      }
    }

    // Get tools/functions if any
    if (agent.tools && agent.tools.length > 0) {
      fs.writeFileSync(
        path.join(outputDir, "tools.json"),
        JSON.stringify(agent.tools, null, 2)
      );
      console.log(`  ✓ Saved tools.json (${agent.tools.length} tools)`);
    }

    // Create summary
    const summary = {
      agent_id: agentId,
      agent_name: agent.agent_name,
      voice_id: agent.voice_id,
      model: agent.model_choice,
      conversation_flow_id: agent.conversation_flow_id,
      downloaded_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(outputDir, "summary.json"),
      JSON.stringify(summary, null, 2)
    );

    console.log(`  ✅ Complete: ${outputDir}`);

  } catch (error: any) {
    console.error(`  ❌ Error downloading ${agentId}:`, error.message);
  }
}

async function main() {
  console.log("🚀 Starting agent download...");
  console.log(`📦 Target agents: ${AGENT_IDS.length}`);

  for (const agentId of AGENT_IDS) {
    await downloadAgent(agentId);
  }

  console.log("\n✅ All downloads complete!");
  console.log(`📁 Output directory: ${path.join(__dirname, "downloaded-agents")}`);
}

main();
