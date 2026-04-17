import Retell from "retell-sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

async function verifyAgent(agentId: string) {
  const agent = await client.agent.retrieve(agentId);
  console.log(JSON.stringify({
    agent_id: agent.agent_id,
    // @ts-ignore
    agent_name: agent.agent_name,
    // @ts-ignore
    conversation_flow_id: agent.conversation_flow_id,
    // @ts-ignore
    voice_id: agent.voice_id
  }, null, 2));
}

verifyAgent(process.argv[2] || "agent_7130415a405c1b3d53782ebc3c");
