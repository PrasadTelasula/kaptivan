/**
 * URL encoding utilities for Kubernetes resource names
 * Handles special characters in cluster names (especially EKS ARNs)
 */

/**
 * Safely encodes a cluster name for use in URLs
 * Handles EKS ARNs like: arn:aws:eks:us-west-2:123456:cluster/cluster-name
 */
export function encodeClusterName(cluster: string): string {
  return encodeURIComponent(cluster);
}

/**
 * Safely encodes a namespace name for use in URLs
 */
export function encodeNamespace(namespace: string): string {
  return encodeURIComponent(namespace);
}

/**
 * Safely encodes a resource name for use in URLs
 */
export function encodeResourceName(name: string): string {
  return encodeURIComponent(name);
}

/**
 * Encodes all path parameters for Kubernetes API URLs
 */
export function encodeK8sPath(params: {
  cluster?: string;
  namespace?: string;
  name?: string;
  [key: string]: string | undefined;
}): Record<string, string> {
  const encoded: Record<string, string> = {};
  
  if (params.cluster) {
    encoded.cluster = encodeClusterName(params.cluster);
  }
  
  if (params.namespace) {
    encoded.namespace = encodeNamespace(params.namespace);
  }
  
  if (params.name) {
    encoded.name = encodeResourceName(params.name);
  }
  
  // Handle any other parameters
  Object.keys(params).forEach(key => {
    if (key !== 'cluster' && key !== 'namespace' && key !== 'name' && params[key]) {
      encoded[key] = encodeURIComponent(params[key] as string);
    }
  });
  
  return encoded;
}