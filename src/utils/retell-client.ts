/**
 * Retell SDK wrapper with exponential backoff retry logic
 * Handles rate limiting and transient failures
 */

import Retell from "retell-sdk";

export class RetellClientWrapper {
  private client: Retell;
  private maxRetries = 3;
  private baseDelay = 2000; // 2 seconds

  constructor(apiKey: string) {
    this.client = new Retell({ apiKey });
  }

  /**
   * Retry wrapper with exponential backoff
   * Retries on network errors and 5xx status codes
   * Does not retry on 4xx client errors
   */
  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRetryable =
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          (error.status >= 500 && error.status < 600);

        if (!isRetryable || attempt === this.maxRetries - 1) {
          throw error;
        }

        const delay = this.baseDelay * Math.pow(2, attempt);
        console.warn(
          `⚠ Retryable error on attempt ${attempt + 1}/${this.maxRetries}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  async listFlows() {
    return this.withRetry(() => this.client.conversationFlow.list());
  }

  async retrieveFlow(flowId: string) {
    return this.withRetry(() => this.client.conversationFlow.retrieve(flowId));
  }

  async listAgents() {
    return this.withRetry(() => this.client.agent.list());
  }

  async retrieveAgent(agentId: string) {
    return this.withRetry(() => this.client.agent.retrieve(agentId));
  }

  async listComponents() {
    return this.withRetry(() => this.client.conversationFlowComponent.list());
  }

  async retrieveComponent(componentId: string) {
    return this.withRetry(() =>
      this.client.conversationFlowComponent.retrieve(componentId)
    );
  }
}
