#!/bin/bash

echo "=== Testing Pod Deletion Event Capture ==="
echo ""

# Test with a sample deployment
NAMESPACE="default"
DEPLOYMENT="nginx-demo"

echo "1. Checking current pods for deployment: $DEPLOYMENT"
kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT
echo ""

echo "2. Current events in namespace $NAMESPACE:"
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
echo ""

echo "3. Testing API endpoint for timeline events:"
curl -s "http://localhost:8080/api/v1/events/timeline?context=docker-desktop&namespace=$NAMESPACE&resourceName=$DEPLOYMENT&resourceType=Deployment&hours=24" | jq '.events[] | {type, resourceName, message, severity}' 2>/dev/null || echo "API not responding or no events"
echo ""

echo "4. To test pod deletion:"
echo "   a) Open Kaptivan UI: http://localhost:5173"
echo "   b) Go to Topology -> Select docker-desktop cluster"
echo "   c) Select namespace: $NAMESPACE"
echo "   d) Select deployment: $DEPLOYMENT"
echo "   e) Open the Timeline panel at the bottom"
echo "   f) In another terminal, delete a pod:"
echo "      kubectl delete pod <pod-name> -n $NAMESPACE"
echo "   g) Check if deletion event appears in timeline"
echo ""

echo "5. Sample deletion command (DO NOT RUN automatically):"
POD=$(kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$POD" ]; then
    echo "   kubectl delete pod $POD -n $NAMESPACE"
else
    echo "   No pods found for deployment $DEPLOYMENT"
fi