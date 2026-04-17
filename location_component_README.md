# Location Preferred Component

A reusable conversation flow component for extracting and validating the patient's preferred Premier MD location.

## Overview

This component follows the same pattern as the Name and DOB extraction components used in agent `agent_7f9970d8ffabe265abbb553b56`. It collects the patient's preferred location and validates it against the 6 valid Premier MD locations.

## Flow Diagram

```
┌─────────────────┐
│ Location Check  │ ◄─── Entry point
│   (branch)      │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    │ No       │ Yes (location already set)
    ▼          ▼
┌──────────┐  ┌─────────────────┐
│   Ask    │  │    Validate     │
│ Location │  │    Location     │
└────┬─────┘  └────────┬────────┘
     │                 │
     │ Needs help?     │ Valid?
     │                 │
     ▼                 ├─── Yes ──► Exit
┌──────────┐           │
│   Help   │           │ No
│  Choose  │           ▼
│ Location │      ┌────────────┐
└────┬─────┘      │  Invalid   │
     │            │  Fallback  │
     │            └─────┬──────┘
     │                  │
     └──────┬───────────┘
            │
            ▼
    ┌───────────────┐
    │    Extract    │
    │   Location    │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │   Validate    │
    │   Location    │
    └───────────────┘
```

## Nodes

### 1. Location Check (branch)
- **Type**: `branch`
- **Purpose**: Check if `preferred_location` is already set
- **Edges**:
  - If location exists → Validate Location
  - Else → Ask Location

### 2. Ask Location (conversation)
- **Type**: `conversation`
- **Purpose**: Ask caller which location they prefer
- **Prompt**: Asks for preferred location, mentions all 6 locations
- **Accepts**: Various ways to refer to locations (neighborhood name, area description, etc.)
- **Edges**:
  - Caller indicates location → Extract Location
  - Caller needs help → Help Choose Location

### 3. Help Choose Location (conversation)
- **Type**: `conversation`
- **Purpose**: Help undecided callers choose a location
- **Provides**: Brief info about each location (address, hours)
- **Edges**:
  - Caller chooses → Extract Location

### 4. Extract Location (extract_dynamic_variables)
- **Type**: `extract_dynamic_variables`
- **Variables**:
  - `preferred_location` (string): One of 6 standardized values
    - `elmhurst`
    - `brooklyn`
    - `manhattan`
    - `flushing`
    - `soho_endo`
    - `great_neck`
- **Mapping**: Maps caller's response to standardized code
- **Edges**:
  - Location extracted → Validate Location
  - Else → Ask Location

### 5. Validate Location (function)
- **Type**: `function`
- **Tool**: `validate_location` (custom tool)
- **Input**: `preferred_location`
- **Output**:
  - `location_valid` (boolean)
  - `location_address` (string)
  - `location_phone` (string)
  - `location_hours` (object)
  - `location_error` (string)
- **Edges**:
  - Valid → Exit
  - Invalid → Invalid Location Fallback

### 6. Invalid Location Fallback (conversation)
- **Type**: `conversation`
- **Purpose**: Handle invalid location values
- **Prompt**: Politely clarify and re-ask for valid location
- **Edges**:
  - Caller clarifies → Extract Location

### 7. Exit (end)
- **Type**: `end`
- **Purpose**: Component exit point

## Custom Tool: validate_location

### Endpoint
```
POST https://smartsupport.ubiehealth.com/validation/location
```

### Request
```json
{
  "location": "elmhurst"
}
```

### Response (Valid)
```json
{
  "valid": true,
  "address": "87-10 51st Ave, Elmhurst, NY 11373",
  "phone": "(917) 398-2588",
  "hours": {
    "monday_saturday": "8:00 AM – 5:00 PM",
    "sunday": "8:00 AM – 5:00 PM"
  },
  "error": null
}
```

### Response (Invalid)
```json
{
  "valid": false,
  "address": null,
  "phone": null,
  "hours": null,
  "error": "Invalid location code. Must be one of: elmhurst, brooklyn, manhattan, flushing, soho_endo, great_neck"
}
```

## Location Data

### Elmhurst
- **Address**: 87-10 51st Ave, Elmhurst, NY 11373
- **Phone**: (917) 398-2588
- **Hours**:
  - Monday–Saturday: 8:00 AM – 5:00 PM
  - Sunday: 8:00 AM – 5:00 PM

### Brooklyn
- **Address**: 761 55th St., Brooklyn, NY 11220
- **Phone**: (929) 387-8003
- **Hours**:
  - Monday–Saturday: 8:30 AM – 5:00 PM
  - Sunday: 9:00 AM – 3:00 PM

### Manhattan
- **Address**: 198 Canal St., New York, NY 10013
- **Phone**: (212) 219-8010
- **Hours**:
  - Monday–Thursday: 8:30 AM – 5:00 PM
  - Friday–Sunday: Closed (by appointment only)

### Flushing
- **Address**: 37-12 Prince Street, Flushing, NY 11354
- **Phone**: (718) 368-6180
- **Hours**:
  - Monday–Friday: 8:30 AM – 5:00 PM
  - Saturday: 8:00 AM – 5:00 PM
  - Sunday: 8:30 AM – 5:00 PM

### SoHo Endo Ambulatory Surgery Center
- **Address**: 168 Centre Street, New York, NY 10013
- **Phone**: (212) 219-8010
- **Hours**:
  - Monday–Friday: 8:00 AM – 5:00 PM
  - Saturday–Sunday: Closed (by appointment only)

### Great Neck
- **Address**: 440-450 Northern Boulevard, Great Neck, NY 11021
- **Phone**: (516) 855-0165
- **Hours**:
  - Monday–Tuesday: Closed
  - Wednesday–Saturday: 8:30 AM – 5:00 PM
  - Sunday: Closed

## Dynamic Variables

Add these to your flow's `default_dynamic_variables`:

```json
{
  "preferred_location": "",
  "location_valid": "",
  "location_address": "",
  "location_phone": "",
  "location_hours": "",
  "location_error": ""
}
```

## Integration

### Using the Retell SDK

```typescript
// 1. Add the component to your conversation flow
const locationComponent = require('./location_component.json');

// 2. Add the component to your flow
conversationFlow.components.push(locationComponent.component);

// 3. Add the validation tool to your flow
conversationFlow.tools.push(locationComponent.tool);

// 4. Add default dynamic variables
Object.assign(
  conversationFlow.default_dynamic_variables,
  locationComponent.default_dynamic_variables
);

// 5. Reference the component from another node
someNode.edges.push({
  destination_node_id: "loc-location-check", // Component entry point
  transition_condition: {
    type: "prompt",
    prompt: "User needs to select a location"
  }
});
```

### Using Retell Dashboard UI

1. **Import Component**:
   - Open your conversation flow in Dashboard
   - Click "Import Component"
   - Upload `location_component.json`

2. **Add Tool**:
   - Go to Tools tab
   - Click "Add Custom Tool"
   - Copy tool definition from `location_component.json`

3. **Add Variables**:
   - Go to Dynamic Variables
   - Add the 6 variables listed above

4. **Connect Flow**:
   - Add edge from your node to component entry point `loc-location-check`
   - Add edge from component exit `loc-exit` to your next node

## Testing

### Test Cases

1. **Happy Path - Direct**
   - User: "I'd like to go to the Elmhurst location"
   - Expected: Extracts `elmhurst`, validates, exits

2. **Happy Path - Area Description**
   - User: "The one in Brooklyn"
   - Expected: Extracts `brooklyn`, validates, exits

3. **Needs Help**
   - User: "I'm not sure which one"
   - Expected: Provides location info, user chooses, extracts, validates

4. **Invalid Location**
   - User: "The one in Queens Village" (doesn't exist)
   - Expected: Validation fails, re-prompts with valid options

5. **Unclear Response**
   - User: "The surgery center"
   - Expected: Maps to `soho_endo`, validates

## Notes

- **Standardization**: Always extract to one of 6 standardized codes
- **Flexible Input**: Accept various ways to refer to locations
- **Validation**: Always validate against API to ensure data integrity
- **Error Handling**: Gracefully handle invalid locations with clarification
- **Follow Pattern**: Matches Name/DOB component structure for consistency
