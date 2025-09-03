export interface APIGroup {
  name: string;
  preferredVersion: string;
  versions: string[];
}

export interface APIResource {
  name: string;
  singularName: string;
  namespaced: boolean;
  kind: string;
  verbs: string[];
  shortNames: string[];
  categories: string[];
  group: string;
  version: string;
}

export interface ResourceSchema {
  kind: string;
  apiVersion: string;
  description: string;
  properties: Record<string, any>;
  required: string[];
  example: string;
}

export interface ResourceField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  properties?: ResourceField[];
}

export interface ExplainOutput {
  resource: string;
  fieldPath: string;
  explanation: string;
}

export interface TreeNode {
  id: string;
  label: string;
  type: 'group' | 'version' | 'resource' | 'field';
  children?: TreeNode[];
  data?: any;
  expanded?: boolean;
}