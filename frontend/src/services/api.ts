const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  clusters: {
    listClusters: () => api.get<any>('/clusters/config'),
    connectCluster: (context: string) => 
      api.post<any>('/clusters/connect', { context }),
    getClusterInfo: (context: string) => 
      api.get<any>(`/clusters/info?context=${context}`),
  },

  k8s: {
    listNamespaces: (cluster: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces`),
    listPods: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/pods`),
    listServices: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/services`),
    listIngresses: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/ingresses`),
    listNetworkPolicies: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/networkpolicies`),
    listResourceQuotas: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/resourcequotas`),
    listLimitRanges: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/limitranges`),
    listPVCs: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/pvcs`),
    listRoleBindings: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/rolebindings`),
    listRoles: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/roles`),
    listEvents: (cluster: string, namespace: string) => 
      api.get<any>(`/clusters/${cluster}/namespaces/${namespace}/events`),
  },
};

export default api;
export { api };