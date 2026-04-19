/**
 * Type definitions for Retell AI Rollback System
 */

export interface RollbackOptions {
  resourceType: 'agent' | 'flow' | 'component';
  resourceId: string;
  targetVersion?: number;  // For agents/flows
  targetTimestamp?: string; // For components
  dryRun: boolean;
  autoPublish: boolean; // For agents (default true)
  listVersions: boolean; // List available versions only
}

export interface RollbackResult {
  success: boolean;
  resourceType: string;
  resourceId: string;
  oldVersion?: number;
  newVersion?: number;
  changes: string[];
  errors?: string[];
  timestamp: string;
  dryRun: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  action: 'rollback';
  resourceType: string;
  resourceId: string;
  fromVersion?: number;
  toVersion: number;
  executedBy: string;
  dryRun: boolean;
  success: boolean;
  errors?: string[];
}

export interface SnapshotMetadata {
  version?: number;
  timestamp: string;
  file: string;
  checksum: string;
  [key: string]: any;
}

export interface IndexEntry {
  current_version?: number;
  last_checksum?: string;
  name?: string;
  snapshots: SnapshotMetadata[];
}

export interface IndexData {
  [resourceId: string]: IndexEntry;
}
