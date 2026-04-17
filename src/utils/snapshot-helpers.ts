/**
 * Shared utility functions for snapshot management
 * Used by both interactive CLI and automated collector
 */

import fs from "fs";
import crypto from "crypto";

/**
 * Format timestamp for snapshot filenames
 * Returns: YYYYMMDDHHmmss (e.g., 20260417143000)
 */
export function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "");
}

/**
 * Calculate SHA-256 checksum of data
 */
export function calculateChecksum(data: any): string {
  const content = JSON.stringify(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Strip Retell resource ID prefixes
 * conversation_flow_abc123 -> abc123
 * agent_xyz789 -> xyz789
 * conversation_flow_component_def456 -> def456
 */
export function shortId(fullId: string): string {
  return fullId.replace(/^(conversation_flow_|agent_|conversation_flow_component_)/, "");
}

/**
 * Create directory if it doesn't exist
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Load JSON index file or return empty object
 */
export function loadIndexFile(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Save data to JSON file with pretty printing
 */
export function saveIndexFile(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
