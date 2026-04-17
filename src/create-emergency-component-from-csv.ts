/**
 * Create Emergency Detection Component from CSV symptom definitions
 * and add it as a global node to a target agent
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
 * Generate triage edges based on CSV rules
 * Groups symptoms by routing action
 */
function generateTriageEdges(rules: SymptomRule[]): any[] {
  const edges: any[] = [];
  const timestamp = Date.now();

  // Group by routing action
  const actionGroups = new Map<string, SymptomRule[]>();
  rules.forEach((rule) => {
    const key = rule.routingAction.toLowerCase().trim();
    if (!actionGroups.has(key)) {
      actionGroups.set(key, []);
    }
    actionGroups.get(key)!.push(rule);
  });

  // Generate edges for each routing action group
  let edgeIndex = 0;
  actionGroups.forEach((symptoms, action) => {
    const nodeId = `ed-extract-${action.replace(/[^a-z0-9]/g, "-")}-${timestamp}-${edgeIndex}`;

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
  const timestamp = Date.now();

  // Group by routing action
  const actionGroups = new Map<string, SymptomRule[]>();
  rules.forEach((rule) => {
    const key = rule.routingAction.toLowerCase().trim();
    if (!actionGroups.has(key)) {
      actionGroups.set(key, []);
    }
    actionGroups.get(key)!.push(rule);
  });

  let nodeIndex = 0;
  actionGroups.forEach((symptoms, action) => {
    const nodeId = `ed-extract-${action.replace(/[^a-z0-9]/g, "-")}-${timestamp}-${nodeIndex}`;

    // Determine which variables to set based on routing action
    const variables: any[] = [];
    const shouldCall911 = action.includes("call 911");
    const shouldNotifyPhysician = action.includes("notify physician");
    const isDashboardReview = action.includes("dashboard review");

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
 * Generate positive finetune examples for global_node_setting
 */
function generateFinetuneExamples(rules: SymptomRule[]): any[] {
  const transcriptItems: any[] = [];

  // Add examples for each symptom
  rules.forEach((rule) => {
    // Create example with "I'm experiencing" format
    transcriptItems.push({
      content: `I'm experiencing ${rule.symptom}`,
      role: "user",
    });

    // For high priority symptoms, add variations
    if (rule.alertPriority === "critical" || rule.alertPriority === "high") {
      transcriptItems.push({
        content: rule.symptom,
        role: "user",
      });

      // Add "I have" variation
      transcriptItems.push({
        content: `I have ${rule.symptom}`,
        role: "user",
      });
    }
  });

  // Return as single object with transcript array
  return [
    {
      transcript: transcriptItems,
    },
  ];
}

/**
 * Generate condition text for global_node_setting
 */
function generateConditionText(rules: SymptomRule[]): string {
  const categories = Array.from(new Set(rules.map((r) => r.clinicalCategory)));

  const conditionParts = [
    "User describes symptoms or a situation that sounds like a medical emergency",
    "including but not limited to:",
    ...categories.map((cat) => `- ${cat}`),
    "mentions calling 911",
    "or expresses a desire to hurt themselves or someone else",
  ];

  return conditionParts.join(" ");
}

/**
 * Create a new Emergency Detection component based on template and CSV rules
 */
async function createEmergencyComponent(
  templateComponentId: string,
  csvPath: string,
  componentName: string
): Promise<any> {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Create Emergency Detection Component          ║");
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

  // 2. Download template component
  console.log(`🔍 Downloading template component: ${templateComponentId}`);
  const template = await client.conversationFlowComponent.retrieve(templateComponentId);
  console.log(`✅ Template downloaded: "${template.name}"\n`);

  // 3. Find the triage node and exit node
  // @ts-ignore
  const triageNode = template.nodes.find((n: any) => n.name === "Emergency detection");
  if (!triageNode) {
    throw new Error("Could not find 'Emergency detection' node in template");
  }

  // @ts-ignore
  const exitNode = template.nodes.find((n: any) => n.type === "end");
  if (!exitNode) {
    throw new Error("Could not find exit node in template");
  }

  console.log(`🎯 Found triage node: ${triageNode.id}`);
  console.log(`🚪 Found exit node: ${exitNode.id}\n`);

  // 4. Generate new edges and extract nodes
  console.log("🔧 Generating new symptom edges and extract nodes...");
  const newEdges = generateTriageEdges(rules);
  const newExtractNodes = generateExtractNodes(rules, exitNode.id);
  console.log(`✅ Generated ${newEdges.length} edges and ${newExtractNodes.length} extract nodes\n`);

  // 5. Update triage node edges
  // Keep crisis and continue edges from template
  const crisisEdge = triageNode.edges.find((e: any) => e.id.includes("crisis"));
  const continueEdge = triageNode.edges.find((e: any) =>
    e.destination_node_id.includes("continue") || e.transition_condition?.prompt?.includes("past")
  );

  const preservedEdges = [];
  if (crisisEdge) preservedEdges.push(crisisEdge);
  if (continueEdge) preservedEdges.push(continueEdge);

  triageNode.edges = [...newEdges, ...preservedEdges];

  console.log(`📝 Updated triage node edges: ${triageNode.edges.length} total edges`);

  // 6. Replace old extract nodes with new ones
  // Remove old symptom-specific extract nodes (keep infrastructure nodes)
  // @ts-ignore
  const infrastructureNodes = template.nodes.filter((n: any) => {
    // Keep: entry, triage, crisis, escalation, goodbye, exit nodes
    return (
      n.id === triageNode.id ||
      n.type === "end" ||
      n.name.includes("Crisis") ||
      n.name.includes("Escalation") ||
      n.name.includes("Goodbye") ||
      n.name === "Extract Variables" // The initial entry node
    );
  });

  const allNodes = [...infrastructureNodes, ...newExtractNodes];
  console.log(`📝 Total nodes: ${allNodes.length}\n`);

  // 7. Create new component
  console.log(`⬆️  Creating new component: "${componentName}"...`);
  try {
    const newComponent = await client.conversationFlowComponent.create({
      name: componentName,
      // @ts-ignore
      start_node_id: template.start_node_id,
      nodes: allNodes,
      // @ts-ignore
      tools: template.tools || [],
    });

    console.log(`✅ Component created successfully!`);
    // @ts-ignore
    console.log(`   Component ID: ${newComponent.conversation_flow_component_id}\n`);

    return newComponent;
  } catch (error: any) {
    console.error("❌ Error creating component:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Generate global_node_setting for use in conversation flow
 */
function createGlobalNodeSetting(
  componentId: string,
  rules: SymptomRule[]
): any {
  const finetuneExamples = generateFinetuneExamples(rules);
  const conditionText = generateConditionText(rules);

  return {
    component_id: componentId,
    condition: conditionText,
    positive_finetune_examples: finetuneExamples,
  };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const templateComponentId = args[0];
  const csvPath = args[1];
  const componentName = args[2] || "Emergency Detection - Custom";
  const outputPath = args[3] || `emergency_component_${Date.now()}.json`;

  if (!templateComponentId || !csvPath) {
    console.log("Usage:");
    console.log("  npm run create-emergency <template-component-id> <csv-path> [component-name] [output-path]");
    console.log("\nExample:");
    console.log('  npm run create-emergency conversation_flow_component_53b48bcfb02e "./symptoms.csv" "Emergency Detection - NewtownGI"');
    console.log("\nThis script will:");
    console.log("  1. Download the template Emergency Detection component");
    console.log("  2. Parse the CSV file with symptom rules");
    console.log("  3. Generate new triage edges and extract variable nodes");
    console.log("  4. Create a new component in Retell AI");
    console.log("  5. Generate a global_node_setting for use in your conversation flow");
    process.exit(1);
  }

  try {
    // Create the component
    const newComponent = await createEmergencyComponent(
      templateComponentId,
      csvPath,
      componentName
    );

    // Parse CSV again for global_node_setting
    const rules = parseCSV(csvPath);

    // Generate global_node_setting
    // @ts-ignore
    const globalNodeSetting = createGlobalNodeSetting(
      newComponent.conversation_flow_component_id,
      rules
    );

    // Save to file
    const output = {
      component: newComponent,
      global_node_setting: globalNodeSetting,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log("═══════════════════════════════════════════════════");
    console.log("✅ Success! Component created and saved");
    console.log("═══════════════════════════════════════════════════");
    // @ts-ignore
    console.log(`Component ID: ${newComponent.conversation_flow_component_id}`);
    console.log(`Component Name: ${componentName}`);
    console.log(`Output file: ${outputPath}`);
    console.log();
    console.log("Next steps:");
    console.log("1. Add this component as a global node to your agent's conversation flow");
    console.log("2. Use the global_node_setting from the output file");
    console.log();
    console.log("Example global node configuration:");
    console.log(JSON.stringify({
      type: "component_node",
      component_id: globalNodeSetting.component_id,
      global_node_setting: {
        condition: globalNodeSetting.condition,
        positive_finetune_examples: globalNodeSetting.positive_finetune_examples,
      },
    }, null, 2));
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
