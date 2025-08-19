import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export function setupInfisicalOperator() {
  // For now, always install the operator
  // TODO: Add proper check for existing operator

  // Install Infisical operator
  const infisicalOperator = new k8s.helm.v3.Chart("infisical-operator", {
    chart: "secrets-operator",
    version: "0.2.0",
    fetchOpts: {
      repo: "https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts",
    },
    namespace: "integra-infrastructure",
    values: {
      controllerManager: {
        replicas: 1,
        resources: {
          limits: {
            cpu: "500m",
            memory: "512Mi",
          },
          requests: {
            cpu: "100m",
            memory: "128Mi",
          },
        },
      },
    },
  });

  return infisicalOperator;
}