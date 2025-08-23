import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { namespaces, serviceRegistry } from "./service-registry";
import { IntegraService } from "./components/IntegraService";
import { setupAPISIX } from "./components/apisix";
import { setupInfisicalOperator } from "./components/infisical";
import { VersionManager } from "./components/VersionManager";

const config = new pulumi.Config();
const environment = config.require("environment");
const containerRegistry = config.require("containerRegistry");

// Initialize version manager for proper version control
const versionManager = new VersionManager(config);

// Get required secrets from config
const dockerRegistryAuth = config.requireSecret("dockerRegistryAuth");
const infisicalServiceToken = config.requireSecret("infisicalServiceToken");

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

// Create Docker registry secret in each namespace
const registrySecrets = new Map<string, k8s.core.v1.Secret>();
for (const [name, namespace] of namespacesMap) {
  const registrySecret = new k8s.core.v1.Secret(`${name}-registry-secret`, {
    metadata: {
      name: "integra-registry",
      namespace: name,
    },
    type: "kubernetes.io/dockerconfigjson",
    stringData: {
      ".dockerconfigjson": dockerRegistryAuth,
    },
  }, { parent: namespace, dependsOn: [namespace] });
  registrySecrets.set(name, registrySecret);
}

// Create Infisical service token secret in each namespace
const infisicalSecrets = new Map<string, k8s.core.v1.Secret>();
for (const [name, namespace] of namespacesMap) {
  const infisicalSecret = new k8s.core.v1.Secret(`${name}-infisical-token`, {
    metadata: {
      name: "infisical-service-token",
      namespace: name,
    },
    type: "Opaque",
    stringData: {
      serviceToken: infisicalServiceToken,
    },
  }, { parent: namespace, dependsOn: [namespace] });
  infisicalSecrets.set(name, infisicalSecret);
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

  const registrySecret = registrySecrets.get(serviceConfig.namespace);
  const infisicalTokenSecret = infisicalSecrets.get(serviceConfig.namespace);

  const service = new IntegraService(serviceConfig.name, {
    name: serviceConfig.name,
    namespace: serviceConfig.namespace,
    image: versionManager.getImageUrl(serviceConfig.image, containerRegistry),
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
    dependsOn: [namespace, infisicalOperator, registrySecret!, infisicalTokenSecret!],
    parent: namespace 
  });

  deployedServices.set(serviceConfig.name, service);
}

// Validate that all services have proper versions
versionManager.validateVersions(serviceRegistry.map(s => s.name));

// Export useful information
export const clusterEndpoint = apisix.loadBalancerIP;
export const deployedServiceNames = Array.from(deployedServices.keys());
export const namespacesList = Array.from(namespacesMap.keys());
export const serviceVersions = versionManager.exportVersions();

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