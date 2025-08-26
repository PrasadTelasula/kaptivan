import type { DeploymentTopology } from '../types';

export const sampleTopologyData: DeploymentTopology = {
  namespace: "production",
  deployment: {
    name: "nginx-deployment",
    replicas: 3,
    available: 2,
    ready: 2,
    updated: 2,
    revision: 2,
    status: "Warning",
    strategy: "RollingUpdate",
    labels: {
      "app": "nginx",
      "version": "v1.2.0",
      "environment": "production",
      "team": "platform"
    },
    conditions: [
      {
        type: "Progressing",
        status: "True",
        reason: "NewReplicaSetAvailable",
        message: "ReplicaSet \"nginx-deployment-7d9fd6b4f9\" has successfully progressed."
      },
      {
        type: "Available",
        status: "False",
        reason: "MinimumReplicasNotAvailable",
        message: "Deployment does not have minimum availability."
      }
    ]
  },
  services: [
    {
      name: "nginx-service",
      type: "LoadBalancer",
      clusterIP: "10.96.10.45",
      externalIPs: ["34.102.136.180"],
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: 8080,
          protocol: "TCP"
        },
        {
          name: "https",
          port: 443,
          targetPort: 8443,
          protocol: "TCP"
        }
      ],
      selector: {
        "app": "nginx"
      }
    },
    {
      name: "nginx-internal",
      type: "ClusterIP",
      clusterIP: "10.96.10.46",
      ports: [
        {
          port: 8080,
          targetPort: 8080,
          protocol: "TCP"
        }
      ],
      selector: {
        "app": "nginx"
      }
    }
  ],
  replicasets: [
    {
      name: "nginx-deployment-7d9fd6b4f9",
      desired: 3,
      ready: 2,
      available: 2,
      generation: 2,
      pods: [
        {
          name: "nginx-deployment-7d9fd6b4f9-2kx5j",
          phase: "Running",
          nodeName: "node-1",
          hostIP: "10.1.1.10",
          podIP: "172.17.0.5",
          qosClass: "Burstable",
          startTime: "2024-01-15T10:30:00Z",
          containers: [
            {
              name: "nginx",
              image: "nginx:1.21-alpine",
              ready: true,
              state: "running",
              restartCount: 0
            },
            {
              name: "sidecar-logger",
              image: "fluent/fluent-bit:2.0",
              ready: true,
              state: "running",
              restartCount: 0
            }
          ]
        },
        {
          name: "nginx-deployment-7d9fd6b4f9-7jk2m",
          phase: "Running",
          nodeName: "node-2",
          hostIP: "10.1.1.11",
          podIP: "172.17.0.6",
          qosClass: "Burstable",
          startTime: "2024-01-15T10:31:00Z",
          containers: [
            {
              name: "nginx",
              image: "nginx:1.21-alpine",
              ready: true,
              state: "running",
              restartCount: 0
            },
            {
              name: "sidecar-logger",
              image: "fluent/fluent-bit:2.0",
              ready: true,
              state: "running",
              restartCount: 1
            }
          ]
        },
        {
          name: "nginx-deployment-7d9fd6b4f9-9xk3p",
          phase: "CrashLoopBackOff",
          nodeName: "node-3",
          hostIP: "10.1.1.12",
          podIP: "172.17.0.7",
          qosClass: "Burstable",
          startTime: "2024-01-15T10:32:00Z",
          containers: [
            {
              name: "nginx",
              image: "nginx:1.21-alpine",
              ready: false,
              state: "waiting",
              reason: "CrashLoopBackOff",
              restartCount: 5
            },
            {
              name: "sidecar-logger",
              image: "fluent/fluent-bit:2.0",
              ready: false,
              state: "waiting",
              restartCount: 5
            }
          ]
        }
      ]
    },
    {
      name: "nginx-deployment-5b69d4f7c8",
      desired: 0,
      ready: 0,
      available: 0,
      generation: 1,
      pods: [
        {
          name: "nginx-deployment-5b69d4f7c8-abc12",
          phase: "Terminating",
          nodeName: "node-1",
          hostIP: "10.1.1.10",
          podIP: "172.17.0.4",
          qosClass: "Burstable",
          containers: [
            {
              name: "nginx",
              image: "nginx:1.20-alpine",
              ready: false,
              state: "terminated",
              restartCount: 0
            }
          ]
        }
      ]
    }
  ],
  secrets: [
    {
      name: "nginx-tls-secret",
      type: "kubernetes.io/tls",
      mountedAt: ["nginx-deployment-7d9fd6b4f9-2kx5j", "nginx-deployment-7d9fd6b4f9-7jk2m"],
      immutable: true
    },
    {
      name: "nginx-basic-auth",
      type: "Opaque",
      mountedAt: ["nginx-deployment-7d9fd6b4f9-2kx5j", "nginx-deployment-7d9fd6b4f9-7jk2m", "nginx-deployment-7d9fd6b4f9-9xk3p"]
    }
  ],
  configmaps: [
    {
      name: "nginx-config",
      mountedAt: ["nginx-deployment-7d9fd6b4f9-2kx5j", "nginx-deployment-7d9fd6b4f9-7jk2m", "nginx-deployment-7d9fd6b4f9-9xk3p"],
      data: {
        "nginx.conf": "...",
        "mime.types": "...",
        "fastcgi.conf": "..."
      }
    }
  ],
  serviceAccount: {
    name: "nginx-sa",
    automountServiceAccountToken: true,
    secrets: ["nginx-sa-token-xyz"]
  }
};