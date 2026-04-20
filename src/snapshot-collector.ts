/**
 * Automated Retell AI Snapshot Collector
 * Non-interactive version for GitHub Actions
 * Detects new versions and downloads snapshots automatically
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getAgentFolderName } from "./utils/folder-naming.js";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({
  apiKey: RETELL_API_KEY,
});

interface SnapshotSummary {
  flows: Array<{ id: string; oldVersion: number; newVersion: number }>;
  agents: Array<{ id: string; oldVersion: number; newVersion: number }>;
  components: Array<{ id: string; oldVersion: number; newVersion: number }>;
  totalNew: number;
  timestamp: string;
}

// Utility functions
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "");
}

function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function shortId(fullId: string): string {
  return fullId.replace(/^(conversation_flow_|agent_|conversation_flow_component_)/, "");
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadIndexFile(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

function saveIndexFile(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
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

  // Verify API key works by making a test request
  console.log("🔑 Verifying API key...");
  try {
    const testFlows = await client.conversationFlow.list();
    if (!testFlows || !Array.isArray(testFlows)) {
      console.error("❌ Error: API returned invalid response. Check your RETELL_API_KEY.");
      process.exit(1);
    }
    console.log("  ✓ API key verified\n");
  } catch (error: any) {
    console.error("❌ Error: Failed to connect to Retell API.");
    console.error(`  Message: ${error.message}`);
    console.error("  Please check your RETELL_API_KEY is correct.");
    process.exit(1);
  }

  // Process flows
  console.log("📋 Checking conversation flows...");
  try {
    const flows = await client.conversationFlow.list();
    console.log(`  Debug: API returned ${flows.length || 0} flows`);

    for (const flow of flows) {
      const flowId = flow.conversation_flow_id;
      const currentVersion = flow.version;
      const lastVersion = flowIndex[flowId]?.current_version || 0;

      console.log(`  Checking flow ${shortId(flowId)}: current v${currentVersion}, last v${lastVersion}`);

      if (currentVersion > lastVersion) {
        console.log(`  ✨ New version detected: ${shortId(flowId)} v${lastVersion} → v${currentVersion}`);

        // Download new version
        const fullFlow = await client.conversationFlow.retrieve(flowId);

        // Create folder structure (flows don't have names, use ID only)
        const flowShortId = shortId(flowId);
        const folderName = `flow_${flowShortId}`;
        const folderPath = path.join("snapshots/flows", folderName);

        // Ensure folder exists
        ensureDirectoryExists(folderPath);

        // Simplified filename
        const filename = `v${currentVersion}_${formatTimestamp()}.json`;
        const filepath = path.join(folderPath, filename);

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
          file: `${folderName}/${filename}`,
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
    console.error(`  ✗ Error processing flows: ${error.message}`);
    console.error(`  Stack: ${error.stack}\n`);
  }

  // Process agents
  console.log("🤖 Checking agents...");
  try {
    const agents = await client.agent.list();
    console.log(`  Debug: API returned ${agents.length || 0} agents`);

    for (const agent of agents) {
      const agentId = agent.agent_id;
      const currentVersion = agent.version;
      const lastVersion = agentIndex[agentId]?.current_version || 0;

      console.log(`  Checking agent ${shortId(agentId)}: current v${currentVersion}, last v${lastVersion}`);

      if (currentVersion > lastVersion) {
        console.log(`  ✨ New version detected: ${shortId(agentId)} v${lastVersion} → v${currentVersion}`);

        // Download new version
        const fullAgent = await client.agent.retrieve(agentId);

        // Extract agent name and create folder structure
        const agentName = fullAgent.agent_name || "Unknown_Agent";
        const folderName = getAgentFolderName(agentName, agentId);
        const folderPath = path.join("snapshots/agents", folderName);

        // Ensure folder exists
        ensureDirectoryExists(folderPath);

        // Simplified filename (no agent ID prefix since it's in folder name)
        const filename = `v${currentVersion}_${formatTimestamp()}.json`;
        const filepath = path.join(folderPath, filename);

        // Save snapshot
        fs.writeFileSync(filepath, JSON.stringify(fullAgent, null, 2));

        // Update index
        if (!agentIndex[agentId]) {
          agentIndex[agentId] = {
            current_version: currentVersion,
            agent_name: agentName,
            snapshots: []
          };
        }
        agentIndex[agentId].current_version = currentVersion;
        agentIndex[agentId].agent_name = agentName;  // Update name if changed
        agentIndex[agentId].snapshots.push({
          version: currentVersion,
          timestamp: new Date().toISOString(),
          file: `${folderName}/${filename}`,  // Include folder prefix
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
    console.error(`  ✗ Error processing agents: ${error.message}`);
    console.error(`  Stack: ${error.stack}\n`);
  }

  // Process components (components don't have version numbers in Retell API)
  console.log("🧩 Checking components...");
  try {
    const components = await client.conversationFlowComponent.list();
    console.log(`  Debug: API returned ${components.length || 0} components`);

    for (const component of components) {
      const componentId = component.conversation_flow_component_id;
      const componentName = component.name;

      // Check if component already exists by comparing checksum
      const fullComponent = await client.conversationFlowComponent.retrieve(componentId);
      const currentChecksum = calculateChecksum(fullComponent);
      const lastChecksum = componentIndex[componentId]?.last_checksum;

      if (currentChecksum !== lastChecksum) {
        const snapshotCount = componentIndex[componentId]?.snapshots?.length || 0;
        console.log(`  ✨ Change detected: ${shortId(componentId)} (${componentName}) - snapshot #${snapshotCount + 1}`);

        // Create folder structure: {component_name}_{component_id}
        const folderName = getAgentFolderName(componentName, componentId);
        const folderPath = path.join("snapshots/components", folderName);

        // Ensure folder exists
        ensureDirectoryExists(folderPath);

        // Simplified filename (timestamp only since components have no version)
        const filename = `${formatTimestamp()}.json`;
        const filepath = path.join(folderPath, filename);

        // Save snapshot
        fs.writeFileSync(filepath, JSON.stringify(fullComponent, null, 2));

        // Update index
        if (!componentIndex[componentId]) {
          componentIndex[componentId] = {
            name: componentName,
            last_checksum: currentChecksum,
            snapshots: [],
          };
        }
        componentIndex[componentId].last_checksum = currentChecksum;
        componentIndex[componentId].name = componentName;
        componentIndex[componentId].snapshots.push({
          timestamp: new Date().toISOString(),
          file: `${folderName}/${filename}`,
          checksum: `sha256:${currentChecksum}`,
          node_count: fullComponent.nodes?.length || 0,
          captured_by: "github-actions",
        });

        // Track change
        summary.components.push({
          id: shortId(componentId),
          oldVersion: snapshotCount,
          newVersion: snapshotCount + 1,
        });
        summary.totalNew++;
      }
    }
    console.log(`  ✓ Processed ${components.length} components\n`);
  } catch (error: any) {
    console.error(`  ✗ Error processing components: ${error.message}`);
    console.error(`  Stack: ${error.stack}\n`);
  }

  // Save updated indices
  saveIndexFile("snapshots/flows/index.json", flowIndex);
  saveIndexFile("snapshots/agents/index.json", agentIndex);
  saveIndexFile("snapshots/components/index.json", componentIndex);

  // Output summary as JSON (for GitHub Actions to parse)
  console.log("📊 Summary:");
  console.log(JSON.stringify(summary, null, 2));

  console.log(`\n✅ Collection complete! ${summary.totalNew} new snapshots captured.`);

  process.exit(0);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
