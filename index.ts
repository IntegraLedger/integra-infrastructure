import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { namespaces, serviceRegistry } from "./service-registry";
import { IntegraService } from "./components/IntegraService";
import { setupAPISIX } from "./components/apisix";
import { setupInfisicalOperator } from "./components/infisical";

const config = new pulumi.Config();
const environment = config.require("environment");
const containerRegistry = config.require("containerRegistry");
const imageOverrides = config.getObject<Record<string, string>>("imageOverrides") || {};

// Create namespaces
const namespacesMap = new Map<string, k8s.core.v1.Namespace>();
for (const [key, name] of Object.entries(namespaces)) {
  const namespace = new k8s.core.v1.Namespace(name, {
    metadata: {
      name,
      labels: {
        "app.kubernetes.io/managed-by": "pulumi",
        "app.kubernetes.io/environment": environment,
      }
    }
  });
  namespacesMap.set(name, namespace);
}

// Setup Infisical Operator
const infisicalOperator = setupInfisicalOperator();

// Setup APISIX
const apisix = setupAPISIX(namespacesMap.get("apisix"));

// Deploy all services
const deployedServices = new Map<string, IntegraService>();

for (const serviceConfig of serviceRegistry) {
  const namespace = namespacesMap.get(serviceConfig.namespace);
  if (!namespace) {
    throw new Error(`Namespace ${serviceConfig.namespace} not found`);
  }

  const service = new IntegraService(serviceConfig.name, {
    name: serviceConfig.name,
    namespace: serviceConfig.namespace,
    image: `${containerRegistry}/${serviceConfig.image}:${imageOverrides[serviceConfig.name] || "latest"}`,
    replicas: serviceConfig.replicas,
    port: serviceConfig.port,
    healthCheck: serviceConfig.healthCheck,
    resources: serviceConfig.resources,
    infisicalPath: serviceConfig.infisicalPath,
    environment,
    domain: serviceConfig.domain,
    exposedPaths: serviceConfig.exposedPaths,
    env: serviceConfig.env,
  }, { 
    dependsOn: [namespace, infisicalOperator],
    parent: namespace 
  });

  deployedServices.set(serviceConfig.name, service);
}

// Export useful information
export const clusterEndpoint = apisix.loadBalancerIP;
export const deployedServiceNames = Array.from(deployedServices.keys());
export const namespacesList = Array.from(namespacesMap.keys());

// Health check status
export const serviceStatuses = pulumi.all(
  Array.from(deployedServices.entries()).map(([name, service]) => 
    service.deployment.status.apply(status => ({
      name,
      ready: status?.readyReplicas === status?.replicas,
      replicas: status?.replicas || 0,
      readyReplicas: status?.readyReplicas || 0
    }))
  )
);