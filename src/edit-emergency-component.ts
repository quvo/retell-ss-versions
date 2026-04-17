/**
 * Edit Emergency Detection component based on CSV symptom definitions
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

interface SymptomRule {
  clinicalCategory: string;
  symptom: string;
  medicationClass: string;
  exampleDrugs: string;
  routingAction: string;
  urgencyLevel: string;
  alertPriority: string;
}

/**
 * Parse CSV file and extract symptom rules
 */
function parseCSV(csvPath: string): SymptomRule[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  const rules: SymptomRule[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);

    if (parts.length >= 7) {
      rules.push({
        clinicalCategory: parts[0],
        symptom: parts[1],
        medicationClass: parts[2],
        exampleDrugs: parts[3],
        routingAction: parts[4],
        urgencyLevel: parts[5],
        alertPriority: parts[6],
      });
    }
  }

  return rules;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Generate symptom detection edges based on CSV rules
 */
function generateSymptomEdges(rules: SymptomRule[]): any[] {
  const edges: any[] = [];
  const nodeMap = new Map<string, string>(); // routing action -> node id

  // Group by routing action
  const actionGroups = new Map<string, SymptomRule[]>();
  rules.forEach((rule) => {
    const key = rule.routingAction.toLowerCase();
    if (!actionGroups.has(key)) {
      actionGroups.set(key, []);
    }
    actionGroups.get(key)!.push(rule);
  });

  // Generate edges for each routing action group
  let edgeIndex = 0;
  actionGroups.forEach((symptoms, action) => {
    const nodeId = `ed-extract-${action.replace(/[^a-z0-9]/g, "-")}-${Date.now()}-${edgeIndex}`;
    nodeMap.set(action, nodeId);

    // Create edge with all symptoms in the prompt
    const symptomDescriptions = symptoms.map((s) => s.symptom).join(" OR ");

    edges.push({
      destination_node_id: nodeId,
      id: `ed-triage-to-${action.replace(/[^a-z0-9]/g, "-")}-${edgeIndex}`,
      transition_condition: {
        type: "prompt",
        prompt: `User describes: ${symptomDescriptions}`,
      },
    });

    edgeIndex++;
  });

  return edges;
}

/**
 * Generate extract variable nodes for each routing action
 */
function generateExtractNodes(rules: SymptomRule[], exitNodeId: string): any[] {
  const nodes: any[] = [];
  const actionGroups = new Map<string, SymptomRule[]>();

  // Group by routing action
  rules.forEach((rule) => {
    const key = rule.routingAction.toLowerCase();
    if (!actionGroups.has(key)) {
      actionGroups.set(key, []);
    }
    actionGroups.get(key)!.push(rule);
  });

  let nodeIndex = 0;
  actionGroups.forEach((symptoms, action) => {
    const nodeId = `ed-extract-${action.replace(/[^a-z0-9]/g, "-")}-${Date.now()}-${nodeIndex}`;

    // Determine which variables to set
    const variables: any[] = [];
    const shouldCall911 = action.includes("call 911");
    const shouldNotifyPhysician = action.includes("notify physician");

    if (shouldCall911) {
      variables.push({
        name: "call_911",
        type: "boolean",
        description: "Set to true when patient needs to call 911",
      });
    }

    if (shouldNotifyPhysician) {
      variables.push({
        name: "notify_physician",
        type: "boolean",
        description: "Set to true when physician needs to be notified",
      });
    }

    // Add emergency_exit_reason
    variables.push({
      name: "emergency_exit_reason",
      type: "string",
      description: shouldCall911 ? "Always set as 'end_call'" : "Always set as 'continue'",
    });

    nodes.push({
      variables: variables,
      else_edge: {
        destination_node_id: exitNodeId,
        id: `${nodeId}-else`,
        transition_condition: {
          type: "prompt",
          prompt: "Else",
        },
      },
      name: `Extract Variables - ${action}`,
      edges: [],
      id: nodeId,
      type: "extract_dynamic_variables",
      display_position: {
        x: 1500 + nodeIndex * 300,
        y: 400 + nodeIndex * 200,
      },
    });

    nodeIndex++;
  });

  return nodes;
}

/**
 * Update Emergency Detection component with CSV-based symptom rules
 */
async function updateEmergencyComponent(
  componentId: string,
  csvPath: string,
  dryRun: boolean = false
) {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Update Emergency Detection Component          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Parse CSV
  console.log(`📄 Parsing CSV: ${csvPath}`);
  const rules = parseCSV(csvPath);
  console.log(`✅ Found ${rules.length} symptom rules\n`);

  // Display summary
  const actionCounts = new Map<string, number>();
  rules.forEach((rule) => {
    const action = rule.routingAction.toLowerCase();
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
  });

  console.log("📊 Routing Action Summary:");
  actionCounts.forEach((count, action) => {
    console.log(`   - ${action}: ${count} symptoms`);
  });
  console.log();

  // 2. Download current component
  console.log(`🔍 Downloading component: ${componentId}`);
  const component = await client.conversationFlowComponent.retrieve(componentId);
  console.log(`✅ Component downloaded: "${component.name}"\n`);

  // 3. Find the triage node
  // @ts-ignore
  const triageNode = component.nodes.find((n: any) => n.name === "Emergency detection");
  if (!triageNode) {
    console.error("❌ Error: Could not find 'Emergency detection' node");
    process.exit(1);
  }

  console.log(`🎯 Found triage node: ${triageNode.id}`);

  // 4. Find the exit node
  // @ts-ignore
  const exitNode = component.nodes.find((n: any) => n.type === "end");
  if (!exitNode) {
    console.error("❌ Error: Could not find exit node");
    process.exit(1);
  }

  console.log(`🚪 Found exit node: ${exitNode.id}\n`);

  // 5. Generate new edges and nodes
  console.log("🔧 Generating new symptom edges and extract nodes...");
  const newEdges = generateSymptomEdges(rules);
  const newExtractNodes = generateExtractNodes(rules, exitNode.id);
  console.log(`✅ Generated ${newEdges.length} edges and ${newExtractNodes.length} extract nodes\n`);

  // 6. Update triage node edges
  const originalEdgeCount = triageNode.edges.length;

  // Keep original crisis and continue edges
  const crisisEdge = triageNode.edges.find((e: any) => e.id.includes("crisis"));
  const continueEdge = triageNode.edges.find((e: any) =>
    e.destination_node_id.includes("continue") || e.transition_condition?.prompt?.includes("past")
  );

  const preservedEdges = [];
  if (crisisEdge) preservedEdges.push(crisisEdge);
  if (continueEdge) preservedEdges.push(continueEdge);

  triageNode.edges = [...newEdges, ...preservedEdges];

  console.log(`📝 Updated triage node edges: ${originalEdgeCount} → ${triageNode.edges.length}`);

  // 7. Add new extract nodes to component
  // @ts-ignore
  const originalNodeCount = component.nodes.length;
  // @ts-ignore
  component.nodes = [...component.nodes, ...newExtractNodes];
  // @ts-ignore
  console.log(`📝 Updated node count: ${originalNodeCount} → ${component.nodes.length}\n`);

  // 8. Save to file (for review)
  const outputPath = path.join(
    process.cwd(),
    `emergency_detection_updated_${Date.now()}.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(component, null, 2));
  console.log(`💾 Updated component saved to: ${outputPath}\n`);

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes uploaded to Retell API");
    console.log("   Review the updated component JSON file above");
    console.log("   Run without --dry-run to apply changes\n");
    return;
  }

  // 9. Upload to Retell
  console.log("⬆️  Uploading updated component to Retell API...");
  try {
    await client.conversationFlowComponent.update(componentId, {
      // @ts-ignore
      nodes: component.nodes,
      // @ts-ignore
      start_node_id: component.start_node_id,
      // @ts-ignore
      tools: component.tools || [],
    });
    console.log("✅ Component successfully updated!\n");

    console.log("═══════════════════════════════════════════════════");
    console.log("Summary:");
    console.log(`  Component ID: ${componentId}`);
    console.log(`  Symptom rules: ${rules.length}`);
    console.log(`  New edges: ${newEdges.length}`);
    console.log(`  New extract nodes: ${newExtractNodes.length}`);
    console.log("═══════════════════════════════════════════════════\n");
  } catch (error: any) {
    console.error("❌ Error uploading component:", error.message);
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
const componentId = nonFlagArgs[0];
const csvPath = nonFlagArgs[1];
const dryRun = args.includes("--dry-run");

if (!componentId || !csvPath) {
  console.log("Usage:");
  console.log("  npm run edit-emergency <component-id> <csv-path> [--dry-run]");
  console.log("\nExample:");
  console.log('  npm run edit-emergency conversation_flow_component_fbbcec2a96e5 "/path/to/symptoms.csv"');
  console.log('  npm run edit-emergency conversation_flow_component_fbbcec2a96e5 "/path/to/symptoms.csv" --dry-run');
  process.exit(1);
}

updateEmergencyComponent(componentId, csvPath, dryRun);
