/**
 * Example: Integrating Location Component into agent_7f9970d8ffabe265abbb553b56
 *
 * This script shows how to add the Location Preferred component to an existing
 * Retell conversation flow using the Retell SDK v5.
 */

import Retell from "retell-sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const client = new Retell({
  apiKey: process.env.RETELL_API_KEY!,
});

// Load the component definition
const locationComponentData = JSON.parse(
  fs.readFileSync("./location_component.json", "utf8")
);

async function integrateLocationComponent() {
  console.log("Starting integration of Location Preferred component...");

  // Step 1: Fetch the existing conversation flow
  const conversationFlowId = "conversation_flow_ef124554e33c"; // Replace with your actual flow ID
  console.log(`Fetching conversation flow: ${conversationFlowId}`);

  const flow = await client.conversationFlow.retrieve(conversationFlowId);
  console.log(`✓ Retrieved flow: ${flow.name || conversationFlowId}`);

  // Step 2: Add the location component
  console.log("\nAdding Location Preferred component...");
  const locationComponent = locationComponentData.component;

  // Check if component already exists
  const existingComponent = flow.components?.find(
    (c: any) => c.conversation_flow_component_id === locationComponent.conversation_flow_component_id
  );

  if (existingComponent) {
    console.log("⚠ Component already exists, replacing...");
    const index = flow.components!.findIndex(
      (c: any) => c.conversation_flow_component_id === locationComponent.conversation_flow_component_id
    );
    flow.components![index] = locationComponent;
  } else {
    if (!flow.components) {
      flow.components = [];
    }
    flow.components.push(locationComponent);
    console.log("✓ Component added");
  }

  // Step 3: Add the validation tool
  console.log("\nAdding validate_location tool...");
  const locationTool = locationComponentData.tool;

  // Check if tool already exists
  const existingTool = flow.tools?.find(
    (t: any) => t.name === locationTool.name
  );

  if (existingTool) {
    console.log("⚠ Tool already exists, replacing...");
    const index = flow.tools!.findIndex(
      (t: any) => t.name === locationTool.name
    );
    flow.tools![index] = locationTool;
  } else {
    if (!flow.tools) {
      flow.tools = [];
    }
    flow.tools.push(locationTool);
    console.log("✓ Tool added");
  }

  // Step 4: Add dynamic variables
  console.log("\nAdding dynamic variables...");
  if (!flow.default_dynamic_variables) {
    flow.default_dynamic_variables = {};
  }

  const newVars = locationComponentData.default_dynamic_variables;
  Object.keys(newVars).forEach((key) => {
    if (!(key in flow.default_dynamic_variables!)) {
      flow.default_dynamic_variables![key] = newVars[key];
      console.log(`  + ${key}`);
    } else {
      console.log(`  - ${key} (already exists)`);
    }
  });
  console.log("✓ Variables added");

  // Step 5: (Optional) Add edge to component from an existing node
  // This example shows how to add the location component after the "Initial Capture" component
  console.log("\nConnecting component to flow...");

  // Find a node to connect from (e.g., end of Initial Capture)
  const initialCaptureComponent = flow.components?.find(
    (c: any) => c.name === "Initial Capture"
  );

  if (initialCaptureComponent) {
    const exitNode = initialCaptureComponent.nodes.find(
      (n: any) => n.type === "end"
    );

    if (exitNode) {
      console.log(`  Found exit node: ${exitNode.id}`);
      console.log(`  You can manually add an edge from your desired node to: loc-location-check`);
      console.log(`  Or add edge from loc-exit to your next component`);
    }
  }

  // Step 6: Update the conversation flow
  console.log("\nUpdating conversation flow...");

  const updatedFlow = await client.conversationFlow.update(conversationFlowId, {
    // @ts-ignore - The SDK types may not match exactly
    components: flow.components,
    tools: flow.tools,
    default_dynamic_variables: flow.default_dynamic_variables,
  });

  console.log("✓ Flow updated successfully!");
  console.log(`\nUpdated flow ID: ${updatedFlow.conversation_flow_id}`);

  // Step 7: Save a backup
  const backupFilename = `flow_backup_${conversationFlowId}_${Date.now()}.json`;
  fs.writeFileSync(backupFilename, JSON.stringify(updatedFlow, null, 2));
  console.log(`\n✓ Backup saved to: ${backupFilename}`);

  return updatedFlow;
}

// Run the integration
integrateLocationComponent()
  .then(() => {
    console.log("\n✅ Integration complete!");
    console.log("\nNext steps:");
    console.log("1. Go to Retell Dashboard");
    console.log("2. Open your conversation flow");
    console.log("3. Find the 'Location Preferred' component");
    console.log("4. Connect it to your flow by adding edges");
    console.log("5. Test the flow using Web Call Test");
  })
  .catch((error) => {
    console.error("\n❌ Error during integration:", error);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    process.exit(1);
  });

/**
 * Alternative: Manual Integration via Dashboard
 *
 * If you prefer to use the Retell Dashboard UI:
 *
 * 1. Export Component:
 *    - Open location_component.json
 *    - Copy the "component" object
 *
 * 2. In Dashboard:
 *    - Go to your conversation flow
 *    - Click "Import Component"
 *    - Paste the component JSON
 *
 * 3. Add Tool:
 *    - Go to Tools tab
 *    - Click "Add Custom Tool"
 *    - Fill in fields from location_component.json "tool" object
 *
 * 4. Add Variables:
 *    - Go to Dynamic Variables
 *    - Add each variable from "default_dynamic_variables"
 *
 * 5. Connect Flow:
 *    - In flow editor, add edge from your node to "loc-location-check"
 *    - Add edge from "loc-exit" to your next node
 */
