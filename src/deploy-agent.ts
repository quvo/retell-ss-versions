/**
 * PremierMD Document Follow-up Voice Agent
 * Retell AI API を使ってConversation Flow Agentをプログラマティックに作成
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER || "+12125551234";

if (!RETELL_API_KEY || !WEBHOOK_URL) {
  console.error("Error: RETELL_API_KEY and WEBHOOK_URL are required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

// Helper functions
const prompt = (text: string, skip = false) => ({
  type: "prompt" as const,
  prompt: text,
  ...(skip ? { skip_user_response: true } : {})
});

const eq = (eqn: string) => ({ type: "equations" as const, equations: [eqn] });
const elseC = () => ({ type: "else" as const });

// Node definitions with correct API v4.66 structure
const nodes: any[] = [
  {
    id: "opening",
    type: "conversation",
    instruction: {
      type: "static_text",
      text: "Thank you for calling PremierMD. I can help you with document and fax inquiries. May I have your full name and date of birth, please?",
    },
    additional_prompt: "Collect patient's full name and date of birth. Confirm both.",
    edges: [{
      id: "e1",
      destination_node_id: "extract_patient",
      transition_condition: prompt("Patient provided name and DOB"),
    }],
  },
  {
    id: "extract_patient",
    type: "extract_dynamic_variables",
    variables: [
      { name: "patient_name", type: "string", description: "Full name" },
      { name: "patient_dob", type: "string", description: "Date of birth" },
    ],
    edges: [{
      id: "e2",
      destination_node_id: "identify_inquiry",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "identify_inquiry",
    type: "conversation",
    instruction: {
      type: "prompt",
      text: "Ask what type of inquiry: fax follow-up, medical records request, or document status check.",
    },
    edges: [{
      id: "e3",
      destination_node_id: "extract_inquiry",
      transition_condition: prompt("Patient indicated inquiry type"),
    }],
  },
  {
    id: "extract_inquiry",
    type: "extract_dynamic_variables",
    variables: [
      { name: "inquiry_type", type: "enum", description: "Inquiry type", choices: ["fax", "records", "status"] },
    ],
    edges: [{
      id: "e4",
      destination_node_id: "split_inquiry",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "split_inquiry",
    type: "branch",
    edges: [
      {
        id: "e5a",
        destination_node_id: "fax_inquiry",
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{ left: "{{inquiry_type}}", operator: "==", right: '"fax"' }],
        },
      },
      {
        id: "e5b",
        destination_node_id: "records_inquiry",
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{ left: "{{inquiry_type}}", operator: "==", right: '"records"' }],
        },
      },
      {
        id: "e5c",
        destination_node_id: "status_inquiry",
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{ left: "{{inquiry_type}}", operator: "==", right: '"status"' }],
        },
      },
    ],
    else_edge: {
      id: "e5d",
      destination_node_id: "identify_inquiry",
      transition_condition: { type: "prompt", prompt: "Else" },
    },
  },
  {
    id: "fax_inquiry",
    type: "conversation",
    instruction: { type: "prompt", text: "Collect fax details: date sent, subject, confirmation number." },
    edges: [{
      id: "e6a",
      destination_node_id: "extract_fax",
      transition_condition: prompt("Fax info collected"),
    }],
  },
  {
    id: "extract_fax",
    type: "extract_dynamic_variables",
    variables: [
      { name: "doc_date_sent", type: "string", description: "Date sent" },
      { name: "doc_subject", type: "string", description: "Subject" },
      { name: "doc_confirmation_number", type: "string", description: "Confirmation number" },
      { name: "doc_method", type: "string", description: "Method (fax)" },
      { name: "is_urgent", type: "boolean", description: "Urgent flag" },
    ],
    edges: [{
      id: "e7a",
      destination_node_id: "urgency_check",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "records_inquiry",
    type: "conversation",
    instruction: { type: "prompt", text: "Collect records request: type, destination, deadline." },
    edges: [{
      id: "e6b",
      destination_node_id: "extract_records",
      transition_condition: prompt("Records info collected"),
    }],
  },
  {
    id: "extract_records",
    type: "extract_dynamic_variables",
    variables: [
      { name: "doc_subject", type: "string", description: "Type of records" },
      { name: "records_destination", type: "string", description: "Destination" },
      { name: "doc_date_sent", type: "string", description: "Deadline" },
      { name: "doc_method", type: "string", description: "Method (records_request)" },
      { name: "is_urgent", type: "boolean", description: "Urgent flag" },
    ],
    edges: [{
      id: "e7b",
      destination_node_id: "urgency_check",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "status_inquiry",
    type: "conversation",
    instruction: { type: "prompt", text: "Collect status check: document type, submission date, method." },
    edges: [{
      id: "e6c",
      destination_node_id: "extract_status",
      transition_condition: prompt("Status info collected"),
    }],
  },
  {
    id: "extract_status",
    type: "extract_dynamic_variables",
    variables: [
      { name: "doc_subject", type: "string", description: "Document name" },
      { name: "doc_date_sent", type: "string", description: "Submitted date" },
      { name: "doc_method", type: "enum", description: "How submitted", choices: ["fax", "email", "portal", "in_person", "mail", "other"] },
      { name: "doc_purpose", type: "string", description: "Purpose" },
      { name: "is_urgent", type: "boolean", description: "Urgent flag" },
    ],
    edges: [{
      id: "e7c",
      destination_node_id: "urgency_check",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "urgency_check",
    type: "branch",
    edges: [
      {
        id: "e8a",
        destination_node_id: "transfer",
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{ left: "{{is_urgent}}", operator: "==", right: "true" }],
        },
      },
    ],
    else_edge: {
      id: "e8b",
      destination_node_id: "confirm_contact",
      transition_condition: { type: "prompt", prompt: "Else" },
    },
  },
  {
    id: "transfer",
    type: "transfer_call",
    transfer_destination: { type: "predefined", number: TRANSFER_NUMBER },
    transfer_option: { type: "cold_transfer" },
    instruction: {
      type: "prompt",
      text: "I understand this is urgent. Let me connect you with a team member.",
    },
    edge: {
      id: "e_transfer_failed",
      destination_node_id: "confirm_contact",
      transition_condition: { type: "prompt", prompt: "Transfer failed" },
    },
  },
  {
    id: "confirm_contact",
    type: "conversation",
    instruction: { type: "prompt", text: "Confirm callback phone number." },
    edges: [{
      id: "e9",
      destination_node_id: "extract_phone",
      transition_condition: prompt("Phone confirmed"),
    }],
  },
  {
    id: "extract_phone",
    type: "extract_dynamic_variables",
    variables: [
      { name: "phone_number", type: "string", description: "Callback number" },
    ],
    edges: [{
      id: "e10",
      destination_node_id: "next_steps",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "next_steps",
    type: "conversation",
    instruction: { type: "prompt", text: "Communicate next steps based on inquiry type." },
    edges: [{
      id: "e11",
      destination_node_id: "closing",
      transition_condition: prompt("Next steps communicated"),
    }],
  },
  {
    id: "closing",
    type: "conversation",
    instruction: {
      type: "static_text",
      text: "Your inquiry has been logged. Anything else I can help with?",
    },
    edges: [
      { id: "e12a", destination_node_id: "log_case", transition_condition: prompt("Patient done") },
      { id: "e12b", destination_node_id: "identify_inquiry", transition_condition: prompt("Another question") },
    ],
  },
  {
    id: "log_case",
    type: "function",
    tool_id: "log_case",
    tool_type: "local",
    wait_for_result: false,
    speak_during_execution: false,
    edges: [{
      id: "e13",
      destination_node_id: "end",
      transition_condition: prompt("Always"),
    }],
  },
  {
    id: "end",
    type: "end",
  },
];

const tools: any[] = [
  {
    type: "custom" as const,
    name: "log_case",
    description: "Log case to webhook",
    tool_id: "log_case",
    url: WEBHOOK_URL,
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Source": "retell-premiermd" },
    parameters: {
      type: "object",
      properties: {
        patient_name: { type: "string", const: "{{patient_name}}" },
        patient_dob: { type: "string", const: "{{patient_dob}}" },
        inquiry_type: { type: "string", const: "{{inquiry_type}}" },
        doc_subject: { type: "string", const: "{{doc_subject}}" },
        doc_date_sent: { type: "string", const: "{{doc_date_sent}}" },
        doc_method: { type: "string", const: "{{doc_method}}" },
        doc_confirmation_number: { type: "string", const: "{{doc_confirmation_number}}" },
        doc_purpose: { type: "string", const: "{{doc_purpose}}" },
        records_destination: { type: "string", const: "{{records_destination}}" },
        is_urgent: { type: "string", const: "{{is_urgent}}" },
        phone_number: { type: "string", const: "{{phone_number}}" },
      },
    },
  },
];

const globalPrompt = `Professional receptionist at PremierMD. Handle document/fax inquiries only. 
Calm, warm, professional tone. Confirm all information. Flag urgent cases appropriately.`;

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  PremierMD Document Follow-up Agent Deployer    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  console.log("Step 1: Creating Conversation Flow...");
  const flow = await client.conversationFlow.create({
    model_choice: { model: "gpt-4.1", type: "cascading" },
    nodes,
    tools,
    global_prompt: globalPrompt,
    start_node_id: "opening",
    start_speaker: "agent",
    default_dynamic_variables: {
      patient_name: "",
      patient_dob: "",
      inquiry_type: "",
      doc_subject: "",
      doc_date_sent: "",
      doc_method: "",
      doc_confirmation_number: "",
      doc_purpose: "",
      records_destination: "",
      is_urgent: "false",
      phone_number: "",
    },
  });
  console.log(`   ✓ Flow created: ${flow.conversation_flow_id}\n`);

  console.log("Step 2: Creating Voice Agent...");
  const agent: any = await client.agent.create({
    agent_name: "PremierMD Document Follow-up Agent",
    response_engine: { type: "conversation-flow" as const, conversation_flow_id: flow.conversation_flow_id },
    voice_id: "11labs-Adrian",
    language: "en-US",
    responsiveness: 0.6,
    interruption_sensitivity: 0.5,
    enable_backchannel: true,
    post_call_analysis_data: [
      { type: "string" as const, name: "patient_name", description: "Patient name", examples: ["John Smith"] },
      { type: "string" as const, name: "inquiry_type", description: "Inquiry type", examples: ["fax", "records"] },
      { type: "boolean" as const, name: "was_urgent", description: "Was urgent" },
      { type: "boolean" as const, name: "was_transferred", description: "Was transferred" },
      { type: "string" as const, name: "resolution_summary", description: "Resolution summary" },
    ],
    webhook_url: WEBHOOK_URL,
    begin_message_delay_ms: 800,
  });
  console.log(`   ✓ Agent created: ${agent.agent_id}\n`);

  console.log("═══════════════════════════════════════════════════");
  console.log("  Deployment complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Flow ID     : ${flow.conversation_flow_id}`);
  console.log(`  Agent ID    : ${agent.agent_id}`);
  console.log(`  Webhook URL : ${WEBHOOK_URL}`);
  console.log(`  Transfer #  : ${TRANSFER_NUMBER}`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
