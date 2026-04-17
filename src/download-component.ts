/**
 * Download a specific Retell AI conversation flow component
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

async function listComponents() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     Retell AI Conversation Flow Components      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    const componentsResponse = await client.conversationFlowComponent.list();
    console.log("Response:", JSON.stringify(componentsResponse, null, 2));

    // @ts-ignore - SDK types may not be fully updated
    const components = componentsResponse.conversation_flow_components || componentsResponse.components || [];

    if (components.length === 0) {
      console.log("  No components found\n");
      return [];
    }

    console.log(`Found ${components.length} components:\n`);
    components.forEach((comp: any, index: number) => {
      console.log(`[${index + 1}] ${comp.conversation_flow_component_id || comp.component_id || comp.id}`);
      if (comp.name) {
        console.log(`    Name: ${comp.name}`);
      }
      if (comp.description) {
        console.log(`    Description: ${comp.description}`);
      }
      console.log();
    });

    return components;
  } catch (error: any) {
    console.error(`Error listing components: ${error.message}`);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function downloadComponent(componentId: string, outputPath?: string) {
  console.log(`\n🔍 Downloading component: ${componentId}\n`);

  try {
    const component = await client.conversationFlowComponent.retrieve(componentId);

    // Determine output path
    const fileName = outputPath || `component_${componentId}.json`;
    const filePath = path.join(process.cwd(), fileName);

    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(component, null, 2));

    console.log(`✅ Component downloaded successfully!`);
    console.log(`📁 Saved to: ${filePath}`);
    console.log(`\n📊 Component details:`);
    console.log(`   ID: ${component.conversation_flow_component_id || 'N/A'}`);
    // @ts-ignore
    console.log(`   Name: ${component.name || 'N/A'}`);
    // @ts-ignore
    if (component.nodes) {
      // @ts-ignore
      console.log(`   Nodes: ${component.nodes.length}`);
    }

    return component;
  } catch (error: any) {
    console.error(`❌ Error downloading component: ${error.message}`);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const componentId = args[1];
const outputPath = args[2];

if (command === "list") {
  listComponents();
} else if (command === "download" && componentId) {
  downloadComponent(componentId, outputPath);
} else {
  console.log("Usage:");
  console.log("  npm run download-component list");
  console.log("  npm run download-component download <component-id> [output-path]");
  console.log("\nExample:");
  console.log("  npm run download-component download component_abc123 emergency_detection.json");
  process.exit(1);
}
