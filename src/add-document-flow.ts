/**
 * Add Document/Fax Follow-up Flow to existing agent
 * agent_6cced6aca0ff4d77c7c7fd2e9a
 */

import Retell from "retell-sdk";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = "agent_6cced6aca0ff4d77c7c7fd2e9a";

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

// Generate unique IDs for nodes
const timestamp = Date.now();
const nodeId = (suffix: string) => `node-${timestamp}-${suffix}`;
const edgeId = (suffix: string) => `edge-${timestamp}-${suffix}`;
const componentId = (suffix: string) => `component-node-${timestamp}-${suffix}`;
const cfComponentId = (suffix: string) => `cf-component-${timestamp}-${suffix}`;

// Document Follow-up Components
const createDocumentComponents = () => [
  // [DF] Name Component
  {
    name: "[DF] Name",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-name"),
    nodes: [
      {
        id: nodeId("df-name-conv"),
        type: "conversation",
        name: "Collect Patient Name",
        instruction: {
          type: "prompt",
          text: "Ask for the patient's full name. Say something like: 'May I have your full name, please?' If they only give first or last name, politely ask for the complete name."
        },
        edges: [{
          id: edgeId("df-name-to-extract"),
          destination_node_id: nodeId("df-name-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Patient has provided their full name"
          }
        }]
      },
      {
        id: nodeId("df-name-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Name",
        variables: [{
          name: "df_patient_name",
          type: "string",
          description: "Patient's full name for document inquiry"
        }],
        edges: [{
          id: edgeId("df-name-extracted"),
          destination_node_id: nodeId("df-name-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_patient_name}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-name-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Name collected"
        }
      }
    ],
    start_node_id: nodeId("df-name-conv")
  },

  // [DF] DOB Component
  {
    name: "[DF] DOB",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-dob"),
    nodes: [
      {
        id: nodeId("df-dob-conv"),
        type: "conversation",
        name: "Collect DOB",
        instruction: {
          type: "prompt",
          text: "Ask for the patient's date of birth. Say: 'And your date of birth, please?' Confirm by repeating it back."
        },
        edges: [{
          id: edgeId("df-dob-to-extract"),
          destination_node_id: nodeId("df-dob-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Patient has provided and confirmed their date of birth"
          }
        }]
      },
      {
        id: nodeId("df-dob-extract"),
        type: "extract_dynamic_variables",
        name: "Extract DOB",
        variables: [{
          name: "df_patient_dob",
          type: "string",
          description: "Patient's date of birth"
        }],
        edges: [{
          id: edgeId("df-dob-extracted"),
          destination_node_id: nodeId("df-dob-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_patient_dob}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-dob-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "DOB collected"
        }
      }
    ],
    start_node_id: nodeId("df-dob-conv")
  },

  // [DF] Inquiry Type Component
  {
    name: "[DF] Inquiry Type",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-inquiry-type"),
    nodes: [
      {
        id: nodeId("df-type-conv"),
        type: "conversation",
        name: "Identify Document Inquiry Type",
        instruction: {
          type: "prompt",
          text: "Ask what type of document inquiry this is. Say: 'Are you calling about a fax you sent, a medical records request, or checking on a document status?' Wait for their response and confirm."
        },
        edges: [{
          id: edgeId("df-type-to-extract"),
          destination_node_id: nodeId("df-type-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Patient has clearly indicated the type of document inquiry"
          }
        }]
      },
      {
        id: nodeId("df-type-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Inquiry Type",
        variables: [{
          name: "df_inquiry_type",
          type: "enum",
          description: "Type of document inquiry",
          choices: ["fax", "records", "status"]
        }],
        edges: [{
          id: edgeId("df-type-extracted"),
          destination_node_id: nodeId("df-type-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_inquiry_type}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-type-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Inquiry type collected"
        }
      }
    ],
    start_node_id: nodeId("df-type-conv")
  },

  // [DF-FAX] Date Sent Component
  {
    name: "[DF-FAX] Date Sent",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-fax-date"),
    nodes: [
      {
        id: nodeId("df-fax-date-conv"),
        type: "conversation",
        name: "Collect Fax Date",
        instruction: {
          type: "prompt",
          text: "Ask when they sent the fax. Say: 'When did you send the fax to us?' Get a specific date or approximate timeframe."
        },
        edges: [{
          id: edgeId("df-fax-date-to-extract"),
          destination_node_id: nodeId("df-fax-date-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Date has been provided"
          }
        }]
      },
      {
        id: nodeId("df-fax-date-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Fax Date",
        variables: [{
          name: "df_date_sent",
          type: "string",
          description: "Date the fax was sent"
        }],
        edges: [{
          id: edgeId("df-fax-date-extracted"),
          destination_node_id: nodeId("df-fax-date-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_date_sent}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-fax-date-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Fax date collected"
        }
      }
    ],
    start_node_id: nodeId("df-fax-date-conv")
  },

  // [DF-FAX] Subject Component
  {
    name: "[DF-FAX] Subject",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-fax-subject"),
    nodes: [
      {
        id: nodeId("df-fax-subject-conv"),
        type: "conversation",
        name: "Collect Fax Subject",
        instruction: {
          type: "prompt",
          text: "Ask what the fax was about. Say: 'What was the fax about - was it a referral, medical records, insurance forms, prior authorization, or something else?' Be specific."
        },
        edges: [{
          id: edgeId("df-fax-subject-to-extract"),
          destination_node_id: nodeId("df-fax-subject-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Subject has been clearly stated"
          }
        }]
      },
      {
        id: nodeId("df-fax-subject-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Fax Subject",
        variables: [{
          name: "df_doc_subject",
          type: "string",
          description: "Subject or purpose of the fax"
        }],
        edges: [{
          id: edgeId("df-fax-subject-extracted"),
          destination_node_id: nodeId("df-fax-subject-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_doc_subject}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-fax-subject-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Fax subject collected"
        }
      }
    ],
    start_node_id: nodeId("df-fax-subject-conv")
  },

  // [DF-FAX] Confirmation Number Component
  {
    name: "[DF-FAX] Confirmation",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-fax-confirm"),
    nodes: [
      {
        id: nodeId("df-fax-confirm-conv"),
        type: "conversation",
        name: "Collect Confirmation Number",
        instruction: {
          type: "prompt",
          text: "Ask if they have a confirmation number. Say: 'Do you have a confirmation number or cover page with tracking information?' If they don't, that's okay - note 'none'."
        },
        edges: [{
          id: edgeId("df-fax-confirm-to-extract"),
          destination_node_id: nodeId("df-fax-confirm-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Confirmation number status is clear"
          }
        }]
      },
      {
        id: nodeId("df-fax-confirm-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Confirmation",
        variables: [{
          name: "df_confirmation_number",
          type: "string",
          description: "Fax confirmation or tracking number, or 'none'"
        }],
        edges: [{
          id: edgeId("df-fax-confirm-extracted"),
          destination_node_id: nodeId("df-fax-confirm-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_confirmation_number}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-fax-confirm-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Confirmation number collected"
        }
      }
    ],
    start_node_id: nodeId("df-fax-confirm-conv")
  },

  // [DF-RECORDS] Record Type Component
  {
    name: "[DF-RECORDS] Type",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-records-type"),
    nodes: [
      {
        id: nodeId("df-records-type-conv"),
        type: "conversation",
        name: "Collect Record Type",
        instruction: {
          type: "prompt",
          text: "Ask what type of records they need. Say: 'What records do you need - therapy notes, medication history, complete file, lab results, imaging, or something else?'"
        },
        edges: [{
          id: edgeId("df-records-type-to-extract"),
          destination_node_id: nodeId("df-records-type-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Record type has been specified"
          }
        }]
      },
      {
        id: nodeId("df-records-type-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Record Type",
        variables: [{
          name: "df_doc_subject",
          type: "string",
          description: "Type of medical records requested"
        }],
        edges: [{
          id: edgeId("df-records-type-extracted"),
          destination_node_id: nodeId("df-records-type-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_doc_subject}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-records-type-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Record type collected"
        }
      }
    ],
    start_node_id: nodeId("df-records-type-conv")
  },

  // [DF-RECORDS] Destination Component
  {
    name: "[DF-RECORDS] Destination",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-records-dest"),
    nodes: [
      {
        id: nodeId("df-records-dest-conv"),
        type: "conversation",
        name: "Collect Records Destination",
        instruction: {
          type: "prompt",
          text: "Ask where the records need to be sent. Say: 'Where do these records need to be sent - another doctor, insurance company, to you directly, or somewhere else?'"
        },
        edges: [{
          id: edgeId("df-records-dest-to-extract"),
          destination_node_id: nodeId("df-records-dest-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Destination has been specified"
          }
        }]
      },
      {
        id: nodeId("df-records-dest-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Destination",
        variables: [{
          name: "df_records_destination",
          type: "string",
          description: "Where the records should be sent"
        }],
        edges: [{
          id: edgeId("df-records-dest-extracted"),
          destination_node_id: nodeId("df-records-dest-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_records_destination}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-records-dest-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Records destination collected"
        }
      }
    ],
    start_node_id: nodeId("df-records-dest-conv")
  },

  // [DF-STATUS] Document Name Component
  {
    name: "[DF-STATUS] Document",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-status-doc"),
    nodes: [
      {
        id: nodeId("df-status-doc-conv"),
        type: "conversation",
        name: "Collect Document Name",
        instruction: {
          type: "prompt",
          text: "Ask what document they're checking on. Say: 'What document are you checking on? Please be specific - is it a referral, lab order, insurance form, or something else?'"
        },
        edges: [{
          id: edgeId("df-status-doc-to-extract"),
          destination_node_id: nodeId("df-status-doc-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Document has been clearly identified"
          }
        }]
      },
      {
        id: nodeId("df-status-doc-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Document Name",
        variables: [{
          name: "df_doc_subject",
          type: "string",
          description: "Name or type of the document being checked"
        }],
        edges: [{
          id: edgeId("df-status-doc-extracted"),
          destination_node_id: nodeId("df-status-doc-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_doc_subject}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-status-doc-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Document name collected"
        }
      }
    ],
    start_node_id: nodeId("df-status-doc-conv")
  },

  // [DF-STATUS] Submission Date Component
  {
    name: "[DF-STATUS] Date Submitted",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-status-date"),
    nodes: [
      {
        id: nodeId("df-status-date-conv"),
        type: "conversation",
        name: "Collect Submission Date",
        instruction: {
          type: "prompt",
          text: "Ask when it was submitted. Say: 'When was it submitted?' Get a specific date or timeframe."
        },
        edges: [{
          id: edgeId("df-status-date-to-extract"),
          destination_node_id: nodeId("df-status-date-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Submission date has been provided"
          }
        }]
      },
      {
        id: nodeId("df-status-date-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Submission Date",
        variables: [{
          name: "df_date_sent",
          type: "string",
          description: "When the document was submitted"
        }],
        edges: [{
          id: edgeId("df-status-date-extracted"),
          destination_node_id: nodeId("df-status-date-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_date_sent}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-status-date-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Submission date collected"
        }
      }
    ],
    start_node_id: nodeId("df-status-date-conv")
  },

  // [DF-STATUS] Method Component
  {
    name: "[DF-STATUS] Method",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-status-method"),
    nodes: [
      {
        id: nodeId("df-status-method-conv"),
        type: "conversation",
        name: "Collect Submission Method",
        instruction: {
          type: "prompt",
          text: "Ask how it was submitted. Say: 'How was it submitted - by fax, email, patient portal, in person, or mail?'"
        },
        edges: [{
          id: edgeId("df-status-method-to-extract"),
          destination_node_id: nodeId("df-status-method-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Method has been identified"
          }
        }]
      },
      {
        id: nodeId("df-status-method-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Method",
        variables: [{
          name: "df_doc_method",
          type: "enum",
          description: "How the document was submitted",
          choices: ["fax", "email", "portal", "in_person", "mail", "other"]
        }],
        edges: [{
          id: edgeId("df-status-method-extracted"),
          destination_node_id: nodeId("df-status-method-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_doc_method}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-status-method-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Submission method collected"
        }
      }
    ],
    start_node_id: nodeId("df-status-method-conv")
  },

  // [DF] Urgency Check Component
  {
    name: "[DF] Urgency Check",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-urgency"),
    nodes: [
      {
        id: nodeId("df-urgency-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Urgency",
        variables: [{
          name: "df_is_urgent",
          type: "boolean",
          description: "True if patient mentioned urgency, upcoming surgery, deadline, repeated follow-ups, or frustration"
        }],
        edges: [{
          id: edgeId("df-urgency-extracted"),
          destination_node_id: nodeId("df-urgency-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_is_urgent}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-urgency-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Urgency assessed"
        }
      }
    ],
    start_node_id: nodeId("df-urgency-extract")
  },

  // [DF] Callback Number Component
  {
    name: "[DF] Callback Number",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-callback"),
    nodes: [
      {
        id: nodeId("df-callback-conv"),
        type: "conversation",
        name: "Collect Callback Number",
        instruction: {
          type: "prompt",
          text: "Confirm callback number. Say: 'What's the best phone number for our team to reach you?' Repeat it back to confirm."
        },
        edges: [{
          id: edgeId("df-callback-to-extract"),
          destination_node_id: nodeId("df-callback-extract"),
          transition_condition: {
            type: "prompt",
            prompt: "Phone number has been confirmed"
          }
        }]
      },
      {
        id: nodeId("df-callback-extract"),
        type: "extract_dynamic_variables",
        name: "Extract Phone",
        variables: [{
          name: "df_phone_number",
          type: "string",
          description: "Patient's callback phone number"
        }],
        edges: [{
          id: edgeId("df-callback-extracted"),
          destination_node_id: nodeId("df-callback-end"),
          transition_condition: {
            type: "equation",
            operator: "||",
            equations: [{
              left: "{{df_phone_number}}",
              operator: "exists"
            }]
          }
        }]
      },
      {
        id: nodeId("df-callback-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Callback number collected"
        }
      }
    ],
    start_node_id: nodeId("df-callback-conv")
  },

  // [DF] Finalization - Fax
  {
    name: "[DF] Finalization Fax",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-final-fax"),
    nodes: [
      {
        id: nodeId("df-final-fax-conv"),
        type: "conversation",
        name: "Fax Next Steps",
        instruction: {
          type: "static_text",
          text: "I'll check with our medical records team, and they'll call you back within one business day to confirm receipt."
        },
        edges: [{
          id: edgeId("df-final-fax-done"),
          destination_node_id: nodeId("df-final-fax-end"),
          transition_condition: {
            type: "prompt",
            prompt: "Always"
          }
        }]
      },
      {
        id: nodeId("df-final-fax-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Fax finalization complete"
        }
      }
    ],
    start_node_id: nodeId("df-final-fax-conv")
  },

  // [DF] Finalization - Records
  {
    name: "[DF] Finalization Records",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-final-records"),
    nodes: [
      {
        id: nodeId("df-final-records-conv"),
        type: "conversation",
        name: "Records Next Steps",
        instruction: {
          type: "static_text",
          text: "Medical records requests typically take five to seven business days to process. You'll receive confirmation once they've been sent."
        },
        edges: [{
          id: edgeId("df-final-records-done"),
          destination_node_id: nodeId("df-final-records-end"),
          transition_condition: {
            type: "prompt",
            prompt: "Always"
          }
        }]
      },
      {
        id: nodeId("df-final-records-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Records finalization complete"
        }
      }
    ],
    start_node_id: nodeId("df-final-records-conv")
  },

  // [DF] Finalization - Status
  {
    name: "[DF] Finalization Status",
    component_id: null,
    conversation_flow_component_id: cfComponentId("df-final-status"),
    nodes: [
      {
        id: nodeId("df-final-status-conv"),
        type: "conversation",
        name: "Status Next Steps",
        instruction: {
          type: "prompt",
          text: "Say: 'I'll have our administrative team review the status and call you back at {{df_phone_number}} within one business day.'"
        },
        edges: [{
          id: edgeId("df-final-status-done"),
          destination_node_id: nodeId("df-final-status-end"),
          transition_condition: {
            type: "prompt",
            prompt: "Always"
          }
        }]
      },
      {
        id: nodeId("df-final-status-end"),
        type: "end",
        name: "Exit Component",
        instruction: {
          type: "static_text",
          text: "Status finalization complete"
        }
      }
    ],
    start_node_id: nodeId("df-final-status-conv")
  }
];

// Main Document Follow-up Router and Flow Nodes
const createDocumentFlowNodes = () => [
  // Document Follow-up Entry Point (connected from Main Router)
  {
    id: nodeId("df-entry"),
    type: "conversation",
    name: "Document Follow-up Welcome",
    instruction: {
      type: "static_text",
      text: "I can help you with document and fax inquiries."
    },
    edges: [{
      id: edgeId("df-entry-to-name"),
      destination_node_id: componentId("df-name"),
      transition_condition: {
        type: "prompt",
        prompt: "Always"
      }
    }]
  },

  // Name Component Node
  {
    id: componentId("df-name"),
    type: "component",
    name: "[DF] Name",
    component_type: "local",
    component_id: cfComponentId("df-name"),
    edges: [{
      id: edgeId("df-name-to-dob"),
      destination_node_id: componentId("df-dob"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_patient_name}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-name-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // DOB Component Node
  {
    id: componentId("df-dob"),
    type: "component",
    name: "[DF] DOB",
    component_type: "local",
    component_id: cfComponentId("df-dob"),
    edges: [{
      id: edgeId("df-dob-to-type"),
      destination_node_id: componentId("df-inquiry-type"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_patient_dob}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-dob-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Inquiry Type Component Node
  {
    id: componentId("df-inquiry-type"),
    type: "component",
    name: "[DF] Inquiry Type",
    component_type: "local",
    component_id: cfComponentId("df-inquiry-type"),
    edges: [{
      id: edgeId("df-type-to-router"),
      destination_node_id: nodeId("df-router"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_inquiry_type}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-type-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Document Type Router
  {
    id: nodeId("df-router"),
    type: "branch",
    name: "Document Type Router",
    edges: [
      {
        id: edgeId("df-router-fax"),
        destination_node_id: componentId("df-fax-date"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"fax"'
          }]
        }
      },
      {
        id: edgeId("df-router-records"),
        destination_node_id: componentId("df-records-type"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"records"'
          }]
        }
      },
      {
        id: edgeId("df-router-status"),
        destination_node_id: componentId("df-status-doc"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"status"'
          }]
        }
      }
    ],
    else_edge: {
      id: edgeId("df-router-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // FAX PATH
  {
    id: componentId("df-fax-date"),
    type: "component",
    name: "[DF-FAX] Date Sent",
    component_type: "local",
    component_id: cfComponentId("df-fax-date"),
    edges: [{
      id: edgeId("df-fax-date-to-subject"),
      destination_node_id: componentId("df-fax-subject"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_date_sent}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-fax-date-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-fax-subject"),
    type: "component",
    name: "[DF-FAX] Subject",
    component_type: "local",
    component_id: cfComponentId("df-fax-subject"),
    edges: [{
      id: edgeId("df-fax-subject-to-confirm"),
      destination_node_id: componentId("df-fax-confirm"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_doc_subject}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-fax-subject-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-fax-confirm"),
    type: "component",
    name: "[DF-FAX] Confirmation",
    component_type: "local",
    component_id: cfComponentId("df-fax-confirm"),
    edges: [{
      id: edgeId("df-fax-confirm-to-urgency"),
      destination_node_id: componentId("df-urgency"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_confirmation_number}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-fax-confirm-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // RECORDS PATH
  {
    id: componentId("df-records-type"),
    type: "component",
    name: "[DF-RECORDS] Type",
    component_type: "local",
    component_id: cfComponentId("df-records-type"),
    edges: [{
      id: edgeId("df-records-type-to-dest"),
      destination_node_id: componentId("df-records-dest"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_doc_subject}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-records-type-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-records-dest"),
    type: "component",
    name: "[DF-RECORDS] Destination",
    component_type: "local",
    component_id: cfComponentId("df-records-dest"),
    edges: [{
      id: edgeId("df-records-dest-to-urgency"),
      destination_node_id: componentId("df-urgency"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_records_destination}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-records-dest-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // STATUS PATH
  {
    id: componentId("df-status-doc"),
    type: "component",
    name: "[DF-STATUS] Document",
    component_type: "local",
    component_id: cfComponentId("df-status-doc"),
    edges: [{
      id: edgeId("df-status-doc-to-date"),
      destination_node_id: componentId("df-status-date"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_doc_subject}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-status-doc-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-status-date"),
    type: "component",
    name: "[DF-STATUS] Date Submitted",
    component_type: "local",
    component_id: cfComponentId("df-status-date"),
    edges: [{
      id: edgeId("df-status-date-to-method"),
      destination_node_id: componentId("df-status-method"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_date_sent}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-status-date-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-status-method"),
    type: "component",
    name: "[DF-STATUS] Method",
    component_type: "local",
    component_id: cfComponentId("df-status-method"),
    edges: [{
      id: edgeId("df-status-method-to-urgency"),
      destination_node_id: componentId("df-urgency"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_doc_method}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-status-method-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // COMMON PATH - Urgency Check
  {
    id: componentId("df-urgency"),
    type: "component",
    name: "[DF] Urgency Check",
    component_type: "local",
    component_id: cfComponentId("df-urgency"),
    edges: [{
      id: edgeId("df-urgency-to-branch"),
      destination_node_id: nodeId("df-urgency-branch"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_is_urgent}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-urgency-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Urgency Branch
  {
    id: nodeId("df-urgency-branch"),
    type: "branch",
    name: "Urgency Branch",
    edges: [{
      id: edgeId("df-urgent-true"),
      destination_node_id: nodeId("df-transfer"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_is_urgent}}",
          operator: "==",
          right: "true"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-urgent-false"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Transfer for Urgent Cases
  {
    id: nodeId("df-transfer"),
    type: "conversation",
    name: "Transfer to Staff",
    instruction: {
      type: "static_text",
      text: "I understand this is urgent. Let me connect you with a team member who can help you right away."
    },
    edges: [{
      id: edgeId("df-transfer-done"),
      destination_node_id: nodeId("df-end"),
      transition_condition: {
        type: "prompt",
        prompt: "Always"
      }
    }]
  },

  // Callback Number
  {
    id: componentId("df-callback"),
    type: "component",
    name: "[DF] Callback Number",
    component_type: "local",
    component_id: cfComponentId("df-callback"),
    edges: [{
      id: edgeId("df-callback-to-final-router"),
      destination_node_id: nodeId("df-final-router"),
      transition_condition: {
        type: "equation",
        operator: "||",
        equations: [{
          left: "{{df_phone_number}}",
          operator: "exists"
        }]
      }
    }],
    else_edge: {
      id: edgeId("df-callback-else"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Finalization Router
  {
    id: nodeId("df-final-router"),
    type: "branch",
    name: "Finalization Router",
    edges: [
      {
        id: edgeId("df-final-fax"),
        destination_node_id: componentId("df-final-fax"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"fax"'
          }]
        }
      },
      {
        id: edgeId("df-final-records"),
        destination_node_id: componentId("df-final-records"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"records"'
          }]
        }
      },
      {
        id: edgeId("df-final-status"),
        destination_node_id: componentId("df-final-status"),
        transition_condition: {
          type: "equation",
          operator: "||",
          equations: [{
            left: "{{df_inquiry_type}}",
            operator: "==",
            right: '"status"'
          }]
        }
      }
    ],
    else_edge: {
      id: edgeId("df-final-else"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Finalization Components
  {
    id: componentId("df-final-fax"),
    type: "component",
    name: "[DF] Finalization Fax",
    component_type: "local",
    component_id: cfComponentId("df-final-fax"),
    edges: [{
      id: edgeId("df-final-fax-to-closing"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Always"
      }
    }],
    else_edge: {
      id: edgeId("df-final-fax-else"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-final-records"),
    type: "component",
    name: "[DF] Finalization Records",
    component_type: "local",
    component_id: cfComponentId("df-final-records"),
    edges: [{
      id: edgeId("df-final-records-to-closing"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Always"
      }
    }],
    else_edge: {
      id: edgeId("df-final-records-else"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },
  {
    id: componentId("df-final-status"),
    type: "component",
    name: "[DF] Finalization Status",
    component_type: "local",
    component_id: cfComponentId("df-final-status"),
    edges: [{
      id: edgeId("df-final-status-to-closing"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Always"
      }
    }],
    else_edge: {
      id: edgeId("df-final-status-else"),
      destination_node_id: nodeId("df-closing"),
      transition_condition: {
        type: "prompt",
        prompt: "Else"
      }
    }
  },

  // Closing
  {
    id: nodeId("df-closing"),
    type: "conversation",
    name: "Document Inquiry Closing",
    instruction: {
      type: "static_text",
      text: "Your document inquiry has been logged. Is there anything else I can assist you with today?"
    },
    edges: [
      {
        id: edgeId("df-closing-done"),
        destination_node_id: nodeId("df-end"),
        transition_condition: {
          type: "prompt",
          prompt: "Patient indicates they are done"
        }
      },
      {
        id: edgeId("df-closing-more"),
        destination_node_id: "start-node-1735258608795", // Return to main welcome
        transition_condition: {
          type: "prompt",
          prompt: "Patient has another question"
        }
      }
    ]
  },

  // End
  {
    id: nodeId("df-end"),
    type: "end",
    name: "End Document Follow-up"
  }
];

async function addDocumentFlow() {
  try {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  Add Document Follow-up Flow to Existing Agent  ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // Load existing conversation flow
    console.log("Step 1: Loading existing conversation flow...");
    const agent = await client.agent.retrieve(AGENT_ID);
    const flowId = (agent.response_engine as any).conversation_flow_id;
    const existingFlow = await client.conversationFlow.retrieve(flowId);

    console.log(`✓ Loaded flow: ${flowId} (version ${existingFlow.version})`);
    console.log(`  Existing nodes: ${existingFlow.nodes?.length || 0}`);
    console.log(`  Existing components: ${existingFlow.components?.length || 0}`);

    // Create new components and nodes
    console.log("\nStep 2: Creating Document Follow-up components and nodes...");
    const newComponents = createDocumentComponents();
    const newNodes = createDocumentFlowNodes();

    console.log(`✓ Created ${newComponents.length} new components`);
    console.log(`✓ Created ${newNodes.length} new nodes`);

    // Merge with existing
    console.log("\nStep 3: Merging with existing flow...");
    const updatedComponents = [...(existingFlow.components || []), ...newComponents];
    const updatedNodes = [...(existingFlow.nodes || []), ...newNodes];

    // Add Document Follow-up option to Main Router (node-1773253483385)
    console.log("\nStep 4: Adding Document Follow-up option to Main Router...");
    const mainRouterIndex = updatedNodes.findIndex((n: any) => n.id === "node-1773253483385");

    if (mainRouterIndex !== -1) {
      const mainRouter: any = updatedNodes[mainRouterIndex];
      mainRouter.edges = mainRouter.edges || [];
      mainRouter.edges.push({
        id: edgeId("main-to-df"),
        destination_node_id: nodeId("df-entry"),
        transition_condition: {
          type: "prompt",
          prompt: "User is calling about a document, fax, or medical records follow-up"
        }
      });
      console.log("✓ Added Document Follow-up route to Main Router");
    } else {
      console.warn("⚠ Main Router not found. You may need to manually connect the flow.");
    }

    // Update conversation flow
    console.log("\nStep 5: Updating conversation flow...");

    // Debug: Save what we're about to send
    const payload: any = {
      nodes: updatedNodes,
      components: updatedComponents,
      default_dynamic_variables: {
        ...(existingFlow.default_dynamic_variables || {}),
        df_patient_name: "",
        df_patient_dob: "",
        df_inquiry_type: "",
        df_doc_subject: "",
        df_date_sent: "",
        df_doc_method: "",
        df_confirmation_number: "",
        df_records_destination: "",
        df_is_urgent: "false",
        df_phone_number: ""
      }
    };

    fs.writeFileSync("debug_payload.json", JSON.stringify(payload, null, 2));
    console.log("✓ Payload saved to debug_payload.json");

    const updatedFlow = await client.conversationFlow.update(flowId, payload);

    console.log(`✓ Flow updated successfully (new version: ${updatedFlow.version})`);

    // Save updated flow to file
    const outputFile = `conversation_flow_${flowId}_updated.json`;
    fs.writeFileSync(outputFile, JSON.stringify(updatedFlow, null, 2));
    console.log(`✓ Updated flow saved to: ${outputFile}`);

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Document Follow-up Flow Added Successfully!");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Flow ID         : ${flowId}`);
    console.log(`  New Version     : ${updatedFlow.version}`);
    console.log(`  Total Nodes     : ${updatedFlow.nodes?.length || 0}`);
    console.log(`  Total Components: ${updatedFlow.components?.length || 0}`);
    console.log(`  Entry Point     : ${nodeId("df-entry")}`);
    console.log("═══════════════════════════════════════════════════");
    console.log("\nNext steps:");
    console.log("1. Test the flow in Retell Dashboard");
    console.log("2. Verify all paths work correctly");
    console.log("3. Test urgent vs non-urgent scenarios");

  } catch (error: any) {
    console.error(`\nError: ${error.message}`);
    if (error.status) {
      console.error(`Status: ${error.status}`);
    }
    if (error.error) {
      console.error(`Details: ${JSON.stringify(error.error, null, 2)}`);
    }
    process.exit(1);
  }
}

addDocumentFlow();
