import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

// Configuration
const config = new pulumi.Config();
const environment = config.get("environment") || "dev";
const registry = "registry.digitalocean.com/integra-container-registry";

// Standard resource sizes
const sizes = {
  small: {
    replicas: 1,
    requests: { cpu: "100m", memory: "256Mi" },
    limits: { cpu: "500m", memory: "512Mi" }
  },
  medium: {
    replicas: 2,
    requests: { cpu: "250m", memory: "512Mi" },
    limits: { cpu: "1000m", memory: "1Gi" }
  },
  large: {
    replicas: 3,
    requests: { cpu: "500m", memory: "1Gi" },
    limits: { cpu: "2000m", memory: "2Gi" }
  }
};

// Service configuration (start with 2 services to test)
interface ServiceDef {
  name: string;
  namespace: string;
  type: "frontend" | "backend";
  size: "small" | "medium" | "large";
  port: number;
  infisicalPath: string;
  domain?: string;
}

const services: ServiceDef[] = [
  {
    name: "integra-trust-app",
    namespace: "integra-apps",
    type: "frontend",
    size: "medium",
    port: 3000,
    infisicalPath: "/apps/integra-trust-app",
    domain: "trustwithintegra.com"
  },
  {
    name: "integra-bridge-service",
    namespace: "integra-apps",
    type: "backend",
    size: "large",
    port: 3000,
    infisicalPath: "/apps/integra-bridge-service",
    domain: "api.trustwithintegra.com"
  }
];

// Create namespaces
const namespaces = new Map<string, k8s.core.v1.Namespace>();
["integra-apps", "integra-blockchain", "integra-workflow", "integra-infrastructure"].forEach(name => {
  const ns = new k8s.core.v1.Namespace(name, {
    metadata: {
      name,
      labels: {
        "app.kubernetes.io/managed-by": "pulumi",
        "app.kubernetes.io/environment": environment
      }
    }
  });
  namespaces.set(name, ns);
});

// Create registry secret in each namespace
const registryAuth = config.requireSecret("dockerRegistryAuth");
namespaces.forEach((ns, name) => {
  new k8s.core.v1.Secret(`${name}-registry`, {
    metadata: {
      name: "integra-registry",
      namespace: name
    },
    type: "kubernetes.io/dockerconfigjson",
    stringData: {
      ".dockerconfigjson": registryAuth
    }
  }, { parent: ns });
});

// Single component for ALL services - NO special cases
class IntegraMicroservice extends pulumi.ComponentResource {
  public deployment: k8s.apps.v1.Deployment;
  public service: k8s.core.v1.Service;

  constructor(
    name: string,
    args: ServiceDef & { version: string },
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("integra:service", name, {}, opts);

    const size = sizes[args.size];
    const labels = { app: name };

    // InfisicalSecret for environment variables
    const infisicalSecret = new k8s.apiextensions.CustomResource(`${name}-env`, {
      apiVersion: "secrets.infisical.com/v1alpha1",
      kind: "InfisicalSecret",
      metadata: {
        name: `${name}-env`,
        namespace: args.namespace
      },
      spec: {
        hostAPI: "https://app.infisical.com/api",
        resyncInterval: 60,
        authentication: {
          universalAuth: {
            credentialsRef: {
              secretName: "infisical-service-token",
              secretNamespace: args.namespace
            }
          }
        },
        managedSecretReference: {
          secretName: `${name}-env`,
          secretNamespace: args.namespace
        },
        secretsPath: args.infisicalPath,
        projectId: "acd53ca1-6365-4874-874f-15d62453c34f",
        envSlug: environment
      }
    }, { parent: this });

    // Deployment - IDENTICAL for all services
    this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
      metadata: {
        name,
        namespace: args.namespace,
        labels
      },
      spec: {
        replicas: size.replicas,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            imagePullSecrets: [{ name: "integra-registry" }],
            containers: [{
              name: "app",
              image: `${registry}/${name}:${args.version}`,
              ports: [{ containerPort: args.port }],
              envFrom: [{ secretRef: { name: `${name}-env` } }],
              resources: {
                requests: size.requests,
                limits: size.limits
              },
              livenessProbe: {
                httpGet: { path: "/health", port: args.port },
                initialDelaySeconds: 30,
                periodSeconds: 30
              },
              readinessProbe: {
                httpGet: { path: "/health", port: args.port },
                initialDelaySeconds: 10,
                periodSeconds: 10
              }
            }]
          }
        }
      }
    }, { parent: this, dependsOn: [infisicalSecret] });

    // Service - IDENTICAL for all services
    this.service = new k8s.core.v1.Service(`${name}-service`, {
      metadata: {
        name,
        namespace: args.namespace,
        labels
      },
      spec: {
        selector: labels,
        ports: [{
          port: args.port,
          targetPort: args.port,
          protocol: "TCP"
        }]
      }
    }, { parent: this });
  }
}

// Deploy services with versions from environment or default
const deployments = new Map<string, IntegraMicroservice>();
services.forEach(service => {
  // Get version from config or use a default
  const version = config.get(`versions.${service.name}`) || "latest";
  
  const deployment = new IntegraMicroservice(service.name, {
    ...service,
    version
  }, { 
    parent: namespaces.get(service.namespace),
    dependsOn: [namespaces.get(service.namespace)!]
  });
  
  deployments.set(service.name, deployment);
});

// Export information
export const deployedServices = services.map(s => s.name);
export const namespaceList = Array.from(namespaces.keys());
export const serviceEndpoints = pulumi.all(
  Array.from(deployments.entries()).map(([name, deployment]) => 
    deployment.service.metadata.apply(m => ({
      name,
      namespace: m?.namespace,
      service: `${name}.${m?.namespace}.svc.cluster.local`
    }))
  )
);