export interface Cluster {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
}

export interface Resource {
  id: string;
  name: string;
  namespace: string;
  kind: string;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}