// Linter service for interacting with the backend linter API
// Fresh file to avoid Vite caching issues

export interface LintResult {
  check: string;
  severity: string;
  message: string;
  remediation: string;
  object: string;
  line: number;
  column: number;
}

export interface LintSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface LintResponse {
  results: LintResult[];
  summary: LintSummary;
}

export interface CheckInfo {
  name: string;
  description: string;
  severity: string;
  category: string;
}

export interface LintRequest {
  yaml: string;
  namespace?: string;
  kind?: string;
}

export class LinterService {
  private baseUrl: string;

  constructor() {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
    this.baseUrl = `${apiBase}/linter`;
  }

  async lintManifest(request: LintRequest): Promise<LintResponse> {
    const response = await fetch(`${this.baseUrl}/lint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Linting failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getAvailableChecks(): Promise<CheckInfo[]> {
    const response = await fetch(`${this.baseUrl}/checks`);

    if (!response.ok) {
      throw new Error(`Failed to fetch checks: ${response.statusText}`);
    }

    const data = await response.json();
    // Ensure we return an array
    return Array.isArray(data) ? data : [];
  }

  async getCustomChecks(): Promise<CheckInfo[]> {
    const response = await fetch(`${this.baseUrl}/checks/custom`);

    if (!response.ok) {
      throw new Error(`Failed to fetch custom checks: ${response.statusText}`);
    }

    const data = await response.json();
    // Ensure we return an array
    return Array.isArray(data) ? data : [];
  }

  async getCheckDetails(checkName: string): Promise<CheckInfo> {
    const response = await fetch(`${this.baseUrl}/checks/${checkName}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch check details: ${response.statusText}`);
    }

    return response.json();
  }

  async getLintSummary(): Promise<LintSummary> {
    const response = await fetch(`${this.baseUrl}/summary`);

    if (!response.ok) {
      throw new Error(`Failed to fetch lint summary: ${response.statusText}`);
    }

    return response.json();
  }

  async getLintStatistics(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/statistics`);

    if (!response.ok) {
      throw new Error(`Failed to fetch lint statistics: ${response.statusText}`);
    }

    return response.json();
  }
}

export const linterService = new LinterService();
export default linterService;
