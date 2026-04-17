/**
 * Automated Retell AI Snapshot Collector
 * Non-interactive version for GitHub Actions
 * Detects new versions and downloads snapshots automatically
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { RetellClientWrapper } from "./utils/retell-client.js";
import {
  formatTimestamp,
  calculateChecksum,
  shortId,
  ensureDirectoryExists,
  loadIndexFile,
  saveIndexFile,
} from "./utils/snapshot-helpers.js";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

interface SnapshotSummary {
  flows: Array<{ id: string; oldVersion: number; newVersion: number }>;
  agents: Array<{ id: string; oldVersion: number; newVersion: number }>;
  components: Array<{ id: string; oldVersion: number; newVersion: number }>;
  totalNew: number;
  timestamp: string;
}

async function main() {
  const client = new RetellClientWrapper(RETELL_API_KEY!);
  const summary: SnapshotSummary = {
    flows: [],
    agents: [],
    components: [],
    totalNew: 0,
    timestamp: new Date().toISOString(),
  };

  console.log("🔍 Starting snapshot collection...\n");

  // Ensure directory structure exists
  ensureDirectoryExists("snapshots/flows");
  ensureDirectoryExists("snapshots/agents");
  ensureDirectoryExists("snapshots/components");

  // Load existing indices
  const flowIndex = loadIndexFile("snapshots/flows/index.json");
  const agentIndex = loadIndexFile("snapshots/agents/index.json");
  const componentIndex = loadIndexFile("snapshots/components/index.json");

  // Process flows
  console.log("📋 Checking conversation flows...");
  try {
    const flowsResponse: any = await client.listFlows();
    const flows = flowsResponse.conversation_flows || [];

    for (const flow of flows) {
      const flowId = flow.conversation_flow_id;
      const currentVersion = flow.version;
      const lastVersion = flowIndex[flowId]?.current_version || 0;

      if (currentVersion > lastVersion) {
        console.log(
          `  ✨ New version detected: ${shortId(flowId)} v${lastVersion} → v${currentVersion}`
        );

        // Download new version
        const fullFlow = await client.retrieveFlow(flowId);
        const filename = `flow_${shortId(flowId)}_v${currentVersion}_${formatTimestamp()}.json`;
        const filepath = path.join("snapshots/flows", filename);

        // Save snapshot
        fs.writeFileSync(filepath, JSON.stringify(fullFlow, null, 2));

        // Update index
        if (!flowIndex[flowId]) {
          flowIndex[flowId] = { current_version: currentVersion, snapshots: [] };
        }
        flowIndex[flowId].current_version = currentVersion;
        flowIndex[flowId].snapshots.push({
          version: currentVersion,
          timestamp: new Date().toISOString(),
          file: filename,
          checksum: `sha256:${calculateChecksum(fullFlow)}`,
          node_count: fullFlow.nodes?.length || 0,
          tool_count: fullFlow.tools?.length || 0,
          captured_by: "github-actions",
        });

        // Track change
        summary.flows.push({
          id: shortId(flowId),
          oldVersion: lastVersion,
          newVersion: currentVersion,
        });
        summary.totalNew++;
      }
    }
    console.log(`  ✓ Processed ${flows.length} flows\n`);
  } catch (error: any) {
    console.error(`  ✗ Error processing flows: ${error.message}\n`);
  }

  // Process agents
  console.log("🤖 Checking agents...");
  try {
    const agentsResponse: any = await client.listAgents();
    const agents = agentsResponse.agents || [];

    for (const agent of agents) {
      const agentId = agent.agent_id;
      const currentVersion = agent.version;
      const lastVersion = agentIndex[agentId]?.current_version || 0;

      if (currentVersion > lastVersion) {
        console.log(
          `  ✨ New version detected: ${shortId(agentId)} v${lastVersion} → v${currentVersion}`
        );

        // Download new version
        const fullAgent = await client.retrieveAgent(agentId);
        const filename = `agent_${shortId(agentId)}_v${currentVersion}_${formatTimestamp()}.json`;
        const filepath = path.join("snapshots/agents", filename);

        // Save snapshot
        fs.writeFileSync(filepath, JSON.stringify(fullAgent, null, 2));

        // Update index
        if (!agentIndex[agentId]) {
          agentIndex[agentId] = { current_version: currentVersion, snapshots: [] };
        }
        agentIndex[agentId].current_version = currentVersion;
        agentIndex[agentId].snapshots.push({
          version: currentVersion,
          timestamp: new Date().toISOString(),
          file: filename,
          checksum: `sha256:${calculateChecksum(fullAgent)}`,
          voice_id: fullAgent.voice_id,
          captured_by: "github-actions",
        });

        // Track change
        summary.agents.push({
          id: shortId(agentId),
          oldVersion: lastVersion,
          newVersion: currentVersion,
        });
        summary.totalNew++;
      }
    }
    console.log(`  ✓ Processed ${agents.length} agents\n`);
  } catch (error: any) {
    console.error(`  ✗ Error processing agents: ${error.message}\n`);
  }

  // Process components
  console.log("🧩 Checking components...");
  try {
    const componentsResponse: any = await client.listComponents();
    const components = componentsResponse.conversation_flow_components || [];

    for (const component of components) {
      const componentId = component.conversation_flow_component_id;
      const currentVersion = component.version;
      const lastVersion = componentIndex[componentId]?.current_version || 0;

      if (currentVersion > lastVersion) {
        console.log(
          `  ✨ New version detected: ${shortId(componentId)} v${lastVersion} → v${currentVersion}`
        );

        // Download new version
        const fullComponent = await client.retrieveComponent(componentId);
        const filename = `component_${shortId(componentId)}_v${currentVersion}_${formatTimestamp()}.json`;
        const filepath = path.join("snapshots/components", filename);

        // Save snapshot
        fs.writeFileSync(filepath, JSON.stringify(fullComponent, null, 2));

        // Update index
        if (!componentIndex[componentId]) {
          componentIndex[componentId] = {
            current_version: currentVersion,
            snapshots: [],
          };
        }
        componentIndex[componentId].current_version = currentVersion;
        componentIndex[componentId].snapshots.push({
          version: currentVersion,
          timestamp: new Date().toISOString(),
          file: filename,
          checksum: `sha256:${calculateChecksum(fullComponent)}`,
          node_count: fullComponent.nodes?.length || 0,
          captured_by: "github-actions",
        });

        // Track change
        summary.components.push({
          id: shortId(componentId),
          oldVersion: lastVersion,
          newVersion: currentVersion,
        });
        summary.totalNew++;
      }
    }
    console.log(`  ✓ Processed ${components.length} components\n`);
  } catch (error: any) {
    console.error(`  ✗ Error processing components: ${error.message}\n`);
  }

  // Save updated indices
  saveIndexFile("snapshots/flows/index.json", flowIndex);
  saveIndexFile("snapshots/agents/index.json", agentIndex);
  saveIndexFile("snapshots/components/index.json", componentIndex);

  // Output summary as JSON (for GitHub Actions to parse)
  console.log("📊 Summary:");
  console.log(JSON.stringify(summary, null, 2));

  console.log(
    `\n✅ Collection complete! ${summary.totalNew} new snapshots captured.`
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
