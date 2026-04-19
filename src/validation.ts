/**
 * Validation utilities for Retell AI Rollback System
 * Pre-validation and post-validation checks
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import Retell from "retell-sdk";
import { IndexData, SnapshotMetadata } from "./types/rollback-types.js";

export function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export interface PreValidationResult {
  valid: boolean;
  errors: string[];
  snapshotPath?: string;
  snapshotData?: any;
  currentData?: any;
}

export async function preValidateRollback(
  resourceType: 'agent' | 'flow' | 'component',
  resourceId: string,
  targetVersion: number | undefined,
  targetTimestamp: string | undefined,
  client: Retell
): Promise<PreValidationResult> {
  const errors: string[] = [];

  // 1. Load index file
  const indexPath = `snapshots/${resourceType}s/index.json`;
  if (!fs.existsSync(indexPath)) {
    errors.push(`Index file not found: ${indexPath}`);
    return { valid: false, errors };
  }

  const indexData: IndexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const fullResourceId = resourceType === 'flow'
    ? `conversation_flow_${resourceId}`
    : resourceType === 'agent'
    ? `agent_${resourceId}`
    : `conversation_flow_component_${resourceId}`;

  // 2. Check if resource exists in index
  if (!indexData[fullResourceId]) {
    errors.push(`Resource ${fullResourceId} not found in index`);
    return { valid: false, errors };
  }

  const indexEntry = indexData[fullResourceId];
  let snapshot: SnapshotMetadata | undefined;

  // 3. Find target snapshot
  if (resourceType === 'component') {
    // Components use timestamp
    if (!targetTimestamp) {
      errors.push("Target timestamp is required for components");
      return { valid: false, errors };
    }
    snapshot = indexEntry.snapshots.find(s => s.timestamp === targetTimestamp);
    if (!snapshot) {
      errors.push(`Snapshot with timestamp ${targetTimestamp} not found`);
      return { valid: false, errors };
    }
  } else {
    // Agents and flows use version
    if (targetVersion === undefined) {
      errors.push("Target version is required for agents and flows");
      return { valid: false, errors };
    }
    snapshot = indexEntry.snapshots.find(s => s.version === targetVersion);
    if (!snapshot) {
      errors.push(`Version ${targetVersion} not found in snapshots`);
      return { valid: false, errors };
    }
  }

  // 4. Check snapshot file exists
  const snapshotPath = path.join(`snapshots/${resourceType}s`, snapshot.file);
  if (!fs.existsSync(snapshotPath)) {
    errors.push(`Snapshot file not found: ${snapshotPath}`);
    return { valid: false, errors };
  }

  // 5. Load and validate snapshot checksum
  const snapshotData = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  const actualChecksum = calculateChecksum(snapshotData);
  const expectedChecksum = snapshot.checksum.replace('sha256:', '');

  if (actualChecksum !== expectedChecksum) {
    errors.push(`Checksum mismatch for snapshot. Expected: ${expectedChecksum}, Got: ${actualChecksum}`);
    return { valid: false, errors };
  }

  // 6. Verify API connectivity and resource exists
  try {
    let currentData: any;
    if (resourceType === 'agent') {
      currentData = await client.agent.retrieve(fullResourceId);
    } else if (resourceType === 'flow') {
      currentData = await client.conversationFlow.retrieve(fullResourceId);
    } else {
      currentData = await client.conversationFlowComponent.retrieve(fullResourceId);
    }

    return {
      valid: true,
      errors: [],
      snapshotPath,
      snapshotData,
      currentData
    };
  } catch (error: any) {
    errors.push(`Failed to retrieve resource from API: ${error.message}`);
    return { valid: false, errors };
  }
}

export interface PostValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function postValidateRollback(
  resourceType: 'agent' | 'flow' | 'component',
  resourceId: string,
  expectedData: any,
  client: Retell
): Promise<PostValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fullResourceId = resourceType === 'flow'
    ? `conversation_flow_${resourceId}`
    : resourceType === 'agent'
    ? `agent_${resourceId}`
    : `conversation_flow_component_${resourceId}`;

  try {
    // Retrieve updated resource
    let updatedData: any;
    if (resourceType === 'agent') {
      updatedData = await client.agent.retrieve(fullResourceId);
    } else if (resourceType === 'flow') {
      updatedData = await client.conversationFlow.retrieve(fullResourceId);
    } else {
      updatedData = await client.conversationFlowComponent.retrieve(fullResourceId);
    }

    // Compare critical fields (excluding version, timestamps, etc.)
    const fieldsToCompare = resourceType === 'agent'
      ? ['agent_name', 'voice_id', 'response_engine', 'webhook_url']
      : resourceType === 'flow'
      ? ['conversation_flow_name', 'nodes', 'edges', 'tools']
      : ['name', 'nodes', 'edges'];

    for (const field of fieldsToCompare) {
      const expected = JSON.stringify(expectedData[field]);
      const actual = JSON.stringify(updatedData[field]);

      if (expected !== actual) {
        warnings.push(`Field ${field} may differ from expected snapshot`);
      }
    }

    return {
      valid: true,
      errors: [],
      warnings
    };
  } catch (error: any) {
    errors.push(`Post-validation failed: ${error.message}`);
    return { valid: false, errors, warnings };
  }
}
