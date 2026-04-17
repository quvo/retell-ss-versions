/**
 * Create snapshot of current conversation flow or agent state
 * Retell AI Version Manager - Snapshot Creation
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { stdin as input, stdout as output } from "process";
import readline from "readline";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });
const SNAPSHOTS_DIR = path.join(process.env.HOME!, ".claude/skills/retell-version-manager/snapshots");
const INDEX_FILE = path.join(SNAPSHOTS_DIR, "index.json");

interface SnapshotMetadata {
  version: number;
  timestamp: string;
  file: string;
  note: string;
  checksum: string;
  node_count?: number;
  tool_count?: number;
  voice_id?: string;
}

interface SnapshotIndex {
  flows: Record<string, SnapshotMetadata[]>;
  agents: Record<string, SnapshotMetadata[]>;
}

// Ensure snapshots directory exists
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// Initialize or load index
function loadIndex(): SnapshotIndex {
  if (!fs.existsSync(INDEX_FILE)) {
    return { flows: {}, agents: {} };
  }
  const content = fs.readFileSync(INDEX_FILE, "utf-8");
  return JSON.parse(content);
}

function saveIndex(index: SnapshotIndex): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function calculateChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "");
}

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function listFlows() {
  const response = await client.conversationFlow.list();
  return response.conversation_flows || [];
}

async function listAgents() {
  const response = await client.agent.list();
  return response.agents || [];
}

async function createSnapshot() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Retell AI Version Manager - Create Snapshot   ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Step 1: Ask resource type
  const resourceType = await askQuestion("Which resource type?\n  (1) Conversation Flow\n  (2) Agent\n\nEnter choice: ");

  if (resourceType !== "1" && resourceType !== "2") {
    console.error("Invalid choice. Exiting.");
    process.exit(1);
  }

  const isFlow = resourceType === "1";

  // Step 2: List available resources
  console.log("\nFetching available resources...\n");

  let resources: any[];
  if (isFlow) {
    resources = await listFlows();
    console.log("=== Available Conversation Flows ===");
    resources.forEach((flow, index) => {
      console.log(`[${index + 1}] ${flow.conversation_flow_id}`);
      console.log(`    Version: ${flow.version}`);
      console.log(`    Updated: ${new Date(flow.updated_at).toISOString().split("T")[0]}`);
      if (flow.nodes) {
        console.log(`    Nodes: ${flow.nodes.length}`);
      }
      console.log();
    });
  } else {
    resources = await listAgents();
    console.log("=== Available Agents ===");
    resources.forEach((agent, index) => {
      console.log(`[${index + 1}] ${agent.agent_id}`);
      if (agent.agent_name) {
        console.log(`    Name: ${agent.agent_name}`);
      }
      console.log(`    Voice: ${agent.voice_id || "N/A"}`);
      console.log(`    Updated: ${new Date(agent.updated_at).toISOString().split("T")[0]}`);
      console.log();
    });
  }

  if (resources.length === 0) {
    console.log("No resources found.");
    process.exit(0);
  }

  // Step 3: Select resource
  const selection = await askQuestion("\nWhich resource to snapshot? (enter number): ");
  const selectedIndex = parseInt(selection) - 1;

  if (selectedIndex < 0 || selectedIndex >= resources.length) {
    console.error("Invalid selection. Exiting.");
    process.exit(1);
  }

  const resource = resources[selectedIndex];
  const resourceId = isFlow ? resource.conversation_flow_id : resource.agent_id;

  // Step 4: Retrieve latest version
  console.log(`\nRetrieving latest version of ${resourceId}...`);

  let resourceData: any;
  if (isFlow) {
    resourceData = await client.conversationFlow.retrieve(resourceId);
  } else {
    resourceData = await client.agent.retrieve(resourceId);
  }

  console.log(`✓ Retrieved version ${resourceData.version}`);

  // Step 5: Ask for note
  const note = await askQuestion("\nAdd a note for this snapshot? (optional, press Enter to skip): ");

  // Step 6: Generate snapshot filename
  const timestamp = formatTimestamp();
  const prefix = isFlow ? "flow" : "agent";
  const shortId = resourceId.replace(/^(conversation_flow_|agent_)/, "");
  const filename = `${prefix}_${shortId}_v${resourceData.version}_${timestamp}.json`;
  const filePath = path.join(SNAPSHOTS_DIR, filename);

  // Step 7: Save snapshot file
  fs.writeFileSync(filePath, JSON.stringify(resourceData, null, 2));
  console.log(`✓ Snapshot saved: ${filename}`);

  // Step 8: Calculate checksum
  const checksum = calculateChecksum(filePath);

  // Step 9: Update index
  const index = loadIndex();
  const indexKey = isFlow ? "flows" : "agents";

  if (!index[indexKey][resourceId]) {
    index[indexKey][resourceId] = [];
  }

  const metadata: SnapshotMetadata = {
    version: resourceData.version,
    timestamp: new Date().toISOString(),
    file: filename,
    note: note || "",
    checksum,
  };

  if (isFlow) {
    metadata.node_count = resourceData.nodes?.length || 0;
    metadata.tool_count = resourceData.tools?.length || 0;
  } else {
    metadata.voice_id = resourceData.voice_id;
  }

  index[indexKey][resourceId].push(metadata);
  saveIndex(index);

  // Step 10: Show confirmation
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Snapshot Created Successfully!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Resource ID    : ${resourceId}`);
  console.log(`  Version        : v${resourceData.version}`);
  if (isFlow) {
    console.log(`  Nodes          : ${metadata.node_count}`);
    console.log(`  Tools          : ${metadata.tool_count}`);
  } else {
    console.log(`  Voice          : ${metadata.voice_id}`);
  }
  if (note) {
    console.log(`  Note           : ${note}`);
  }
  console.log(`  File           : ${filename}`);
  console.log(`  Checksum       : ${checksum.substring(0, 16)}...`);
  console.log("═══════════════════════════════════════════════════\n");
}

createSnapshot().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
