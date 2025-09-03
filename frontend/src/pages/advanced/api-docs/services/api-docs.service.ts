import { apiUrls } from '@/utils/api-urls';
import type { APIGroup, APIResource, ResourceSchema, ExplainOutput } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const apiDocsService = {
  async getAPIGroups(context: string): Promise<APIGroup[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/apidocs/groups?context=${encodeURIComponent(context)}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API groups: ${response.statusText}`);
    }
    
    return response.json();
  },

  async getAPIResources(context: string, group: string, version: string): Promise<APIResource[]> {
    const params = new URLSearchParams({
      context,
      group: group || '',
      version,
    });
    
    const response = await fetch(
      `${API_BASE_URL}/api/v1/apidocs/resources?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API resources: ${response.statusText}`);
    }
    
    return response.json();
  },

  async getResourceSchema(
    context: string,
    group: string,
    version: string,
    kind: string
  ): Promise<ResourceSchema> {
    const params = new URLSearchParams({
      context,
      group: group || '',
      version,
      kind,
    });
    
    const response = await fetch(
      `${API_BASE_URL}/api/v1/apidocs/schema?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch resource schema: ${response.statusText}`);
    }
    
    return response.json();
  },

  async getResourceExplain(
    context: string,
    resource: string,
    fieldPath?: string
  ): Promise<ExplainOutput> {
    const params = new URLSearchParams({
      context,
      resource,
    });
    
    if (fieldPath) {
      params.append('fieldPath', fieldPath);
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/v1/apidocs/explain?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch resource explanation: ${response.statusText}`);
    }
    
    return response.json();
  },

  async searchResources(context: string, query: string): Promise<APIResource[]> {
    const params = new URLSearchParams({
      context,
      query,
    });
    
    const response = await fetch(
      `${API_BASE_URL}/api/v1/apidocs/search?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to search resources: ${response.statusText}`);
    }
    
    return response.json();
  },
};