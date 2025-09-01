#!/bin/bash

# Test script to verify pod deletion events are captured

echo "Testing pod deletion event capture..."

# Get a pod from the default namespace (or whatever namespace has pods)
POD=$(kubectl get pods -n default -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$POD" ]; then
    echo "No pods found in default namespace, checking kube-system..."
    POD=$(kubectl get pods -n kube-system -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    NAMESPACE="kube-system"
else
    NAMESPACE="default"
fi

if [ -z "$POD" ]; then
    echo "No pods found to test with"
    exit 1
fi

echo "Found pod: $POD in namespace: $NAMESPACE"

# Get events before deletion
echo "Getting current events..."
kubectl get events -n $NAMESPACE --field-selector involvedObject.name=$POD

# Delete the pod (if it's safe to do so)
echo "Note: This would delete pod $POD. For safety, not executing actual deletion."
echo "To test, manually delete a pod and check the timeline in the UI"

# Command that would delete the pod:
# kubectl delete pod $POD -n $NAMESPACE

# Instead, let's look for deletion-related events in the namespace
echo ""
echo "Looking for recent deletion events in namespace $NAMESPACE:"
kubectl get events -n $NAMESPACE -o json | jq -r '.items[] | select(.reason | test("Killing|Killed|Deleted|Terminating|Terminated|Stopping")) | "\(.firstTimestamp) | \(.involvedObject.kind)/\(.involvedObject.name) | \(.reason): \(.message)"' | tail -20

echo ""
echo "To test pod deletion events:"
echo "1. Open the Kaptivan UI and go to the topology page"
echo "2. Select a deployment and open the timeline"
echo "3. Delete a pod manually: kubectl delete pod <pod-name> -n <namespace>"
echo "4. Check if the deletion event appears in the timeline"