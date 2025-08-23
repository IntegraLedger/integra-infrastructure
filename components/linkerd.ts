import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

/**
 * Linkerd Service Mesh Configuration
 * 
 * This component manages Linkerd-specific configurations including:
 * - Namespace annotations for automatic proxy injection
 * - Service profiles for cross-namespace communication
 * - Traffic policies for service-to-service communication
 */

export interface LinkerdConfig {
  namespaces: string[];
  crossNamespacePolicies?: CrossNamespacePolicy[];
}

export interface CrossNamespacePolicy {
  sourceNamespace: string;
  targetNamespace: string;
  services: string[];
}

export class LinkerdServiceMesh extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: LinkerdConfig,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("integra:linkerd:ServiceMesh", name, {}, opts);

    // Ensure Linkerd injection is enabled for all namespaces
    for (const namespace of args.namespaces) {
      new k8s.core.v1.Namespace(`${namespace}-linkerd-enabled`, {
        metadata: {
          name: namespace,
          annotations: {
            "linkerd.io/inject": "enabled",
            "config.linkerd.io/proxy-await": "enabled",
            "config.linkerd.io/skip-outbound-ports": "4222,5432,6379,27017", // Skip common database ports
          },
          labels: {
            "linkerd.io/control-plane-ns": "linkerd",
            "linkerd.io/is-control-plane": "false",
          }
        }
      }, { parent: this });
    }

    // Create cross-namespace communication policies
    if (args.crossNamespacePolicies) {
      for (const policy of args.crossNamespacePolicies) {
        // Create Server resource for each service that needs to be accessed
        for (const service of policy.services) {
          const serverName = `${service}-${policy.targetNamespace}-server`;
          
          new k8s.apiextensions.CustomResource(serverName, {
            apiVersion: "policy.linkerd.io/v1beta1",
            kind: "Server",
            metadata: {
              name: serverName,
              namespace: policy.targetNamespace,
            },
            spec: {
              podSelector: {
                matchLabels: {
                  app: service
                }
              },
              port: 3000, // Standard port for all services
              proxyProtocol: "HTTP/2",
            }
          }, { parent: this });

          // Create ServerAuthorization for cross-namespace access
          const authName = `${service}-${policy.sourceNamespace}-to-${policy.targetNamespace}`;
          
          new k8s.apiextensions.CustomResource(authName, {
            apiVersion: "policy.linkerd.io/v1beta1",
            kind: "ServerAuthorization",
            metadata: {
              name: authName,
              namespace: policy.targetNamespace,
            },
            spec: {
              server: {
                name: serverName,
              },
              client: {
                meshTLS: {
                  identities: [
                    `*.${policy.sourceNamespace}.serviceaccount.identity.linkerd.cluster.local`
                  ]
                }
              }
            }
          }, { parent: this });
        }
      }
    }

    // Create ServiceProfiles for better observability
    this.createServiceProfiles(args.namespaces);
  }

  private createServiceProfiles(namespaces: string[]) {
    // Common service profiles for HTTP services
    const commonRoutes = [
      { name: "health", condition: { method: "GET", pathRegex: "/health" }, timeout: "5s" },
      { name: "metrics", condition: { method: "GET", pathRegex: "/metrics" }, timeout: "5s" },
      { name: "api", condition: { pathRegex: "/api/.*" }, timeout: "30s", retryBudget: { retryRatio: 0.2, minRetriesPerSecond: 10, ttl: "10s" } },
    ];

    // Create a service profile for each major service
    const services = [
      { name: "integra-rpc-service", namespace: "integra-blockchain" },
      { name: "integra-gateway-service", namespace: "integra-blockchain" },
      { name: "integra-bridge-service", namespace: "integra-apps" },
      { name: "integra-temporal-orchestrator-service", namespace: "integra-workflow" },
      { name: "integra-temporal-messaging-service", namespace: "integra-workflow" },
    ];

    for (const service of services) {
      new k8s.apiextensions.CustomResource(`${service.name}-profile`, {
        apiVersion: "linkerd.io/v1alpha2",
        kind: "ServiceProfile",
        metadata: {
          name: service.name,
          namespace: service.namespace,
        },
        spec: {
          routes: commonRoutes,
          retryBudget: {
            retryRatio: 0.2,
            minRetriesPerSecond: 10,
            ttl: "10s"
          }
        }
      }, { parent: this });
    }
  }
}

/**
 * Helper function to create simplified service URLs for Linkerd mesh
 * When Linkerd is enabled, services can use simple names for same-namespace
 * and service.namespace for cross-namespace communication
 */
export function getMeshServiceUrl(
  serviceName: string,
  targetNamespace: string,
  currentNamespace: string,
  port: number = 3000,
  protocol: string = "http"
): string {
  // If same namespace, use simple name
  if (targetNamespace === currentNamespace) {
    return `${protocol}://${serviceName}:${port}`;
  }
  
  // For cross-namespace, use service.namespace format
  // Linkerd will handle the rest
  return `${protocol}://${serviceName}.${targetNamespace}:${port}`;
}

/**
 * Configuration for cross-namespace communication
 * This defines which services need to communicate across namespaces
 */
export const crossNamespacePolicies: CrossNamespacePolicy[] = [
  // Workflow services need to access blockchain services
  {
    sourceNamespace: "integra-workflow",
    targetNamespace: "integra-blockchain",
    services: [
      "integra-rpc-service",
      "integra-gateway-service",
      "integra-polygon-executor",
      "integra-arbitrum-executor",
      "integra-avalanche-executor",
      "integra-base-executor",
    ]
  },
  // Workflow services need to access app services
  {
    sourceNamespace: "integra-workflow",
    targetNamespace: "integra-apps",
    services: [
      "integra-bridge-service",
      "integra-admin-service",
    ]
  },
  // App services need to access blockchain services
  {
    sourceNamespace: "integra-apps",
    targetNamespace: "integra-blockchain",
    services: [
      "integra-rpc-service",
      "integra-gateway-service",
      "integra-blockchain-api",
    ]
  },
  // App services need to access workflow services
  {
    sourceNamespace: "integra-apps",
    targetNamespace: "integra-workflow",
    services: [
      "integra-temporal-orchestrator-service",
      "integra-temporal-messaging-service",
    ]
  },
  // Blockchain services need to access each other
  {
    sourceNamespace: "integra-blockchain",
    targetNamespace: "integra-blockchain",
    services: [
      "integra-rpc-service",
      "integra-gateway-service",
      "integra-indexer-service",
    ]
  },
];