#!/bin/bash
set -e

echo "Setting up Infisical Universal Auth..."

# These should be obtained from Infisical dashboard
INFISICAL_CLIENT_ID="${INFISICAL_CLIENT_ID}"
INFISICAL_CLIENT_SECRET="${INFISICAL_CLIENT_SECRET}"

if [ -z "$INFISICAL_CLIENT_ID" ] || [ -z "$INFISICAL_CLIENT_SECRET" ]; then
    echo "Please set INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET environment variables"
    echo "You can obtain these from: https://app.infisical.com/project/acd53ca1-6365-4874-874f-15d62453c34f/settings/access-control/machine-identities"
    exit 1
fi

# Create the namespace if it doesn't exist
kubectl create namespace integra-infrastructure --dry-run=client -o yaml | kubectl apply -f -

# Create the universal auth secret
kubectl create secret generic infisical-universal-auth \
    --from-literal=clientId="${INFISICAL_CLIENT_ID}" \
    --from-literal=clientSecret="${INFISICAL_CLIENT_SECRET}" \
    --namespace=integra-infrastructure \
    --dry-run=client -o yaml | kubectl apply -f -

echo "Infisical Universal Auth configured successfully"