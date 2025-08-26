import { encodeClusterName, encodeNamespace, encodeResourceName, encodeK8sPath } from '../url-encoding';

describe('URL Encoding Utilities', () => {
  describe('encodeClusterName', () => {
    it('should encode EKS cluster ARN correctly', () => {
      const eksArn = 'arn:aws:eks:us-west-2:123456789:cluster/my-cluster';
      const encoded = encodeClusterName(eksArn);
      expect(encoded).toBe('arn%3Aaws%3Aeks%3Aus-west-2%3A123456789%3Acluster%2Fmy-cluster');
    });

    it('should encode cluster names with special characters', () => {
      const clusterWithSpecialChars = 'my-cluster:with/special-chars';
      const encoded = encodeClusterName(clusterWithSpecialChars);
      expect(encoded).toBe('my-cluster%3Awith%2Fspecial-chars');
    });

    it('should handle regular cluster names', () => {
      const regularCluster = 'minikube';
      const encoded = encodeClusterName(regularCluster);
      expect(encoded).toBe('minikube');
    });

    it('should handle cluster names with spaces', () => {
      const clusterWithSpaces = 'my cluster name';
      const encoded = encodeClusterName(clusterWithSpaces);
      expect(encoded).toBe('my%20cluster%20name');
    });
  });

  describe('encodeNamespace', () => {
    it('should encode namespace with special characters', () => {
      const namespace = 'my-namespace/with:special';
      const encoded = encodeNamespace(namespace);
      expect(encoded).toBe('my-namespace%2Fwith%3Aspecial');
    });

    it('should handle regular namespace names', () => {
      const namespace = 'default';
      const encoded = encodeNamespace(namespace);
      expect(encoded).toBe('default');
    });
  });

  describe('encodeResourceName', () => {
    it('should encode resource name with special characters', () => {
      const resourceName = 'my-pod:with/special-chars';
      const encoded = encodeResourceName(resourceName);
      expect(encoded).toBe('my-pod%3Awith%2Fspecial-chars');
    });

    it('should handle regular resource names', () => {
      const resourceName = 'nginx-deployment';
      const encoded = encodeResourceName(resourceName);
      expect(encoded).toBe('nginx-deployment');
    });
  });

  describe('encodeK8sPath', () => {
    it('should encode all path parameters', () => {
      const params = {
        cluster: 'arn:aws:eks:us-west-2:123456789:cluster/my-cluster',
        namespace: 'production',
        name: 'my-app'
      };
      const encoded = encodeK8sPath(params);
      
      expect(encoded.cluster).toBe('arn%3Aaws%3Aeks%3Aus-west-2%3A123456789%3Acluster%2Fmy-cluster');
      expect(encoded.namespace).toBe('production');
      expect(encoded.name).toBe('my-app');
    });

    it('should handle missing parameters', () => {
      const params = {
        cluster: 'minikube'
      };
      const encoded = encodeK8sPath(params);
      
      expect(encoded.cluster).toBe('minikube');
      expect(encoded.namespace).toBeUndefined();
      expect(encoded.name).toBeUndefined();
    });

    it('should encode custom parameters', () => {
      const params = {
        cluster: 'minikube',
        customParam: 'value/with:special'
      };
      const encoded = encodeK8sPath(params);
      
      expect(encoded.cluster).toBe('minikube');
      expect(encoded.customParam).toBe('value%2Fwith%3Aspecial');
    });
  });

  describe('Integration test with API URL', () => {
    it('should create valid API URL with EKS cluster name', () => {
      const cluster = 'arn:aws:eks:us-west-2:123456789:cluster/my-cluster';
      const namespace = 'default';
      const podName = 'nginx-pod';
      
      const apiUrl = `/api/v1/pods/${encodeClusterName(cluster)}/${encodeNamespace(namespace)}/${encodeResourceName(podName)}`;
      
      // The URL should be properly encoded
      expect(apiUrl).toBe('/api/v1/pods/arn%3Aaws%3Aeks%3Aus-west-2%3A123456789%3Acluster%2Fmy-cluster/default/nginx-pod');
      
      // When this URL is used in fetch or as a path parameter in backend,
      // the backend framework (Gin) will automatically decode it
    });
  });
});