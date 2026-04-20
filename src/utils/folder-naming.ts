/**
 * Folder naming utilities for agent snapshots
 * Sanitizes agent names for use in folder names
 */

export function sanitizeFolderName(agentName: string): string {
  // Replace spaces and hyphens with underscores
  let sanitized = agentName.replace(/[\s-]+/g, '_');

  // Remove invalid filesystem characters
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '');

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  return sanitized;
}

export function getAgentFolderName(agentName: string, agentId: string): string {
  const sanitizedName = sanitizeFolderName(agentName);
  const shortId = agentId.replace(/^agent_/, '');
  return `${sanitizedName}_${shortId}`;
}
