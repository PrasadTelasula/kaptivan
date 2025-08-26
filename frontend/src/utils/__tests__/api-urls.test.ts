import { apiUrls } from '../api-urls';

describe('Centralized API URL Builder', () => {
  describe('Pod URLs', () => {
    it('should correctly encode EKS cluster ARN in pod URL', () => {
      const cluster = 'arn:aws:eks:us-west-2:123456789:cluster/my-cluster';
      const namespace = 'default';
      const name = 'nginx-pod';
      
      const url = apiUrls.pods.get(cluster, namespace, name);
      
      expect(url).toBe('http://localhost:8080/api/v1/pods/arn%3Aaws%3Aeks%3Aus-west-2%3A123456789%3Acluster%2Fmy-cluster/default/nginx-pod');
    });

    it('should handle WebSocket URL for pod exec', () => {
      const cluster = 'arn:aws:eks:us-west-2:123456789:cluster/my-cluster';
      const namespace = 'production';
      const name = 'app-pod';
      const container = 'main-container';
      
      const wsUrl = apiUrls.pods.execWs(cluster, namespace, name, container);
      
      expect(wsUrl).toBe('ws://localhost:8080/api/v1/pods/arn%3Aaws%3Aeks%3Aus-west-2%3A123456789%3Acluster%2Fmy-cluster/production/app-pod/exec/ws?container=main-container');
    });

    it('should build pod logs URL with query parameters', () => {
      const cluster = 'minikube';
      const namespace = 'default';
      const name = 'test-pod';
      
      const url = apiUrls.pods.logs(cluster, namespace, name, {
        container: 'sidecar',
        tailLines: 100,
        follow: true
      });
      
      expect(url).toContain('/api/v1/pods/minikube/default/test-pod/logs');
      expect(url).toContain('container=sidecar');
      expect(url).toContain('tailLines=100');
      expect(url).toContain('follow=true');
    });
  });

  describe('Topology URLs', () => {
    it('should encode cluster name in topology namespace URL', () => {
      const cluster = 'arn:aws:eks:eu-west-1:987654321:cluster/production';
      
      const url = apiUrls.topology.namespaces(cluster);
      
      expect(url).toBe('http://localhost:8080/api/v1/topology/arn%3Aaws%3Aeks%3Aeu-west-1%3A987654321%3Acluster%2Fproduction/namespaces');
    });

    it('should build deployment topology URL with all parameters encoded', () => {
      const cluster = 'my-cluster:with/special-chars';
      const namespace = 'my-namespace';
      const name = 'my-deployment';
      
      const url = apiUrls.topology.deployments.get(cluster, namespace, name);
      
      expect(url).toBe('http://localhost:8080/api/v1/topology/my-cluster%3Awith%2Fspecial-chars/deployment/my-namespace/my-deployment');
    });

    it('should build cronjob list URL with namespace query parameter', () => {
      const cluster = 'test-cluster';
      const namespace = 'cron-namespace';
      
      const url = apiUrls.topology.cronjobs.list(cluster, namespace);
      
      expect(url).toBe('http://localhost:8080/api/v1/topology/test-cluster/cronjobs?namespace=cron-namespace');
    });
  });

  describe('Deployment URLs', () => {
    it('should encode all parameters in deployment scale URL', () => {
      const cluster = 'arn:aws:eks:ap-south-1:111111111:cluster/staging';
      const namespace = 'apps';
      const name = 'web-server';
      
      const url = apiUrls.deployments.scale(cluster, namespace, name);
      
      expect(url).toBe('http://localhost:8080/api/v1/deployments/arn%3Aaws%3Aeks%3Aap-south-1%3A111111111%3Acluster%2Fstaging/apps/web-server/scale');
    });
  });

  describe('Service URLs', () => {
    it('should encode service endpoint URL correctly', () => {
      const cluster = 'gke_project_zone_cluster-name';
      const namespace = 'microservices';
      const name = 'api-gateway';
      
      const url = apiUrls.services.endpoints(cluster, namespace, name);
      
      expect(url).toBe('http://localhost:8080/api/v1/services/gke_project_zone_cluster-name/microservices/api-gateway/endpoints');
    });
  });

  describe('Manifest URLs', () => {
    it('should build manifest URL with optional query parameters', () => {
      const cluster = 'arn:aws:eks:us-east-1:222222222:cluster/dev';
      const resourceName = 'deployment.apps';
      
      const url = apiUrls.manifests.get(cluster, resourceName, {
        namespace: 'default',
        name: 'nginx',
        group: 'apps',
        version: 'v1',
        kind: 'Deployment'
      });
      
      expect(url).toContain('arn%3Aaws%3Aeks%3Aus-east-1%3A222222222%3Acluster%2Fdev');
      expect(url).toContain('deployment.apps');
      expect(url).toContain('namespace=default');
      expect(url).toContain('name=nginx');
      expect(url).toContain('group=apps');
      expect(url).toContain('version=v1');
      expect(url).toContain('kind=Deployment');
    });

    it('should handle related resources URL', () => {
      const cluster = 'local-cluster';
      const resourceName = 'pod';
      
      const url = apiUrls.manifests.related(cluster, resourceName, {
        namespace: 'kube-system',
        name: 'coredns'
      });
      
      expect(url).toContain('/manifests/local-cluster/pod/related');
      expect(url).toContain('namespace=kube-system');
      expect(url).toContain('name=coredns');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or undefined values gracefully', () => {
      const url = apiUrls.pods.execWs('cluster', 'namespace', 'pod');
      expect(url).not.toContain('undefined');
      expect(url).not.toContain('?container=');
    });

    it('should handle special characters in all parameters', () => {
      const cluster = 'cluster/with:special@chars';
      const namespace = 'namespace#with$special';
      const name = 'name&with=special';
      
      const url = apiUrls.pods.get(cluster, namespace, name);
      
      // Verify no unencoded special characters remain
      expect(url).not.toContain(':');
      expect(url).not.toContain('/cluster');
      expect(url).not.toContain('#');
      expect(url).not.toContain('$');
      expect(url).not.toContain('&');
      expect(url).not.toContain('=special');
    });
  });

  describe('Consistency', () => {
    it('should use consistent encoding across all endpoints', () => {
      const cluster = 'arn:aws:eks:us-west-2:123456:cluster/test';
      const encodedCluster = 'arn%3Aaws%3Aeks%3Aus-west-2%3A123456%3Acluster%2Ftest';
      
      // Check that all endpoints encode the cluster name the same way
      expect(apiUrls.pods.get(cluster, 'ns', 'name')).toContain(encodedCluster);
      expect(apiUrls.deployments.get(cluster, 'ns', 'name')).toContain(encodedCluster);
      expect(apiUrls.services.get(cluster, 'ns', 'name')).toContain(encodedCluster);
      expect(apiUrls.topology.namespaces(cluster)).toContain(encodedCluster);
      expect(apiUrls.manifests.get(cluster, 'resource')).toContain(encodedCluster);
    });
  });
});