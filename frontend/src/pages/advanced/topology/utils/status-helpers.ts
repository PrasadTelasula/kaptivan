import type { K8sStatus, PodPhase } from '../types';

export const phaseToStatus = (phase: PodPhase): K8sStatus => {
  switch (phase) {
    case "Running":
    case "Succeeded":
      return "Healthy";
    case "Pending":
      return "Warning";
    case "Failed":
    case "CrashLoopBackOff":
    case "Terminating":
      return "Error";
    default:
      return "Unknown";
  }
};

export const getDeploymentStatus = (
  replicas: number,
  available: number,
  ready?: number
): K8sStatus => {
  if (available === replicas && (ready === undefined || ready === replicas)) {
    return "Healthy";
  }
  if (available === 0) {
    return "Error";
  }
  if (available < replicas) {
    return "Warning";
  }
  return "Unknown";
};

export const getReplicaSetStatus = (desired: number, ready: number): K8sStatus => {
  if (ready === desired && desired > 0) {
    return "Healthy";
  }
  if (ready === 0 && desired > 0) {
    return "Error";
  }
  if (ready < desired) {
    return "Warning";
  }
  return "Unknown";
};

export const getContainerStatus = (container: {
  ready: boolean;
  state?: string;
  restartCount?: number;
}): K8sStatus => {
  if (container.ready && container.state === "running") {
    return "Healthy";
  }
  if (container.state === "terminated" || (container.restartCount && container.restartCount > 3)) {
    return "Error";
  }
  if (container.state === "waiting" || !container.ready) {
    return "Warning";
  }
  return "Unknown";
};

export const statusToColor = (status: K8sStatus): string => {
  switch (status) {
    case "Healthy":
      return "#10b981"; // green-500
    case "Warning":
      return "#f59e0b"; // amber-500
    case "Error":
      return "#ef4444"; // red-500
    case "Unknown":
    default:
      return "#6b7280"; // gray-500
  }
};

export const statusToBorderColor = (status: K8sStatus): string => {
  switch (status) {
    case "Healthy":
      return "#059669"; // green-600
    case "Warning":
      return "#d97706"; // amber-600
    case "Error":
      return "#dc2626"; // red-600
    case "Unknown":
    default:
      return "#4b5563"; // gray-600
  }
};

export const phaseToColor = (phase: PodPhase): string => {
  switch (phase) {
    case "Running":
      return "#10b981";
    case "Succeeded":
      return "#059669";
    case "Pending":
      return "#f59e0b";
    case "Failed":
      return "#ef4444";
    case "CrashLoopBackOff":
      return "#dc2626";
    case "Terminating":
      return "#f97316";
    default:
      return "#6b7280";
  }
};