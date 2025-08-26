#!/bin/bash

# Test script to verify secrets are being returned correctly

echo "Testing topology API for secrets..."

# You'll need to update these values
NAMESPACE="apps"
DEPLOYMENT="sample-app"
CLUSTER="your-cluster-context"
API_URL="http://localhost:8080"

# Make the API call and pretty print the response
echo "Calling: ${API_URL}/api/v1/topology?namespace=${NAMESPACE}&deployment=${DEPLOYMENT}&cluster=${CLUSTER}"

curl -s "${API_URL}/api/v1/topology?namespace=${NAMESPACE}&deployment=${DEPLOYMENT}&cluster=${CLUSTER}" | \
  python3 -m json.tool | \
  grep -A 20 '"secrets"'

echo ""
echo "Total secrets count:"
curl -s "${API_URL}/api/v1/topology?namespace=${NAMESPACE}&deployment=${DEPLOYMENT}&cluster=${CLUSTER}" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('secrets', [])))"