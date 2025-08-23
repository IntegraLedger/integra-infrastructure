export interface ServiceConfig {
  name: string;
  namespace: string;
  replicas: number;
  image: string;
  port: number;
  healthCheck?: string;
  env?: Record<string, string>;
  infisicalPath: string;
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  domain?: string;
  exposedPaths?: string[];
}

export const namespaces = {
  apps: "integra-apps",
  blockchain: "integra-blockchain", 
  workflow: "integra-workflow",
  infrastructure: "integra-infrastructure",
  monitoring: "integra-monitoring"
} as const;

const sizes = {
  small: {
    requests: { cpu: "100m", memory: "256Mi" },
    limits: { cpu: "500m", memory: "512Mi" }
  },
  medium: {
    requests: { cpu: "250m", memory: "512Mi" },
    limits: { cpu: "1000m", memory: "1Gi" }
  },
  large: {
    requests: { cpu: "500m", memory: "1Gi" },
    limits: { cpu: "2000m", memory: "2Gi" }
  }
};

export const serviceRegistry: ServiceConfig[] = [
  // Frontend Applications
  {
    name: "integra-trust-app",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-trust-app",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-trust-app",
    resources: sizes.medium,
    domain: "trustwithintegra.com",
    exposedPaths: ["/*"]
  },
  {
    name: "integra-developer-app",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-developer-app",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-developer-app",
    resources: sizes.medium,
    domain: "developer.trustwithintegra.com",
    exposedPaths: ["/*"]
  },
  {
    name: "integra-admin-app",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-admin-app",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-admin-app",
    resources: sizes.medium,
    domain: "admin.trustwithintegra.com",
    exposedPaths: ["/*"]
  },
  {
    name: "integra-explorer-app",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-explorer-app",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-explorer-app",
    resources: sizes.small,
    domain: "explorer.trustwithintegra.com",
    exposedPaths: ["/*"]
  },
  {
    name: "integra-docs-app",
    namespace: namespaces.apps,
    replicas: 1,
    image: "integra-docs-app",
    port: 3000,
    healthCheck: "/",
    infisicalPath: "/apps/integra-docs-app",
    resources: sizes.small,
    domain: "docs.trustwithintegra.com",
    exposedPaths: ["/*"]
  },

  // Core Services
  {
    name: "integra-bridge-service",
    namespace: namespaces.apps,
    replicas: 3,
    image: "integra-bridge-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-bridge-service",
    resources: sizes.large,
    domain: "api.trustwithintegra.com",
    exposedPaths: ["/v1/*", "/admin/*", "/oauth2/*"]
  },
  {
    name: "integra-developer-service",
    namespace: namespaces.apps,
    replicas: 3,
    image: "integra-developer-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-developer-service",
    resources: sizes.large,
    domain: "api2.trustwithintegra.com",
    exposedPaths: ["/v1/*", "/oauth2/*"]
  },
  {
    name: "integra-admin-service",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-admin-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-admin-service",
    resources: sizes.medium
  },
  {
    name: "integra-ai-help-service",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-ai-help-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-ai-help-service",
    resources: sizes.medium
  },
  {
    name: "integra-dev-assistant-service",
    namespace: namespaces.apps,
    replicas: 1,
    image: "integra-dev-assistant-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-dev-assistant",
    resources: sizes.small
  },

  // Blockchain Services
  {
    name: "integra-blockchain-api",
    namespace: namespaces.blockchain,
    replicas: 3,
    image: "integra-blockchain-api",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-blockchain-api",
    resources: sizes.large,
    domain: "tx.trustwithintegra.com",
    exposedPaths: ["/v1/*", "/api/*"]
  },
  {
    name: "integra-gateway-service",
    namespace: namespaces.blockchain,
    replicas: 2,
    image: "integra-gateway-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-gateway-service",
    resources: sizes.medium
  },
  {
    name: "integra-rpc-service",
    namespace: namespaces.blockchain,
    replicas: 3,
    image: "integra-rpc-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-rpc-service",
    resources: sizes.large
  },
  {
    name: "integra-indexer-service",
    namespace: namespaces.blockchain,
    replicas: 2,
    image: "integra-indexer-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-indexer-service",
    resources: sizes.large
  },
  {
    name: "integra-proof-service",
    namespace: namespaces.blockchain,
    replicas: 2,
    image: "integra-proof-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/Integra-proof-service",
    resources: sizes.medium
  },
  {
    name: "integra-hogan-api",
    namespace: namespaces.blockchain,
    replicas: 2,
    image: "integra-hogan-api",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-hogan-api",
    resources: sizes.medium
  },

  // Executor Services
  {
    name: "integra-polygon-executor",
    namespace: namespaces.blockchain,
    replicas: 2,
    image: "integra-polygon-executor",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-polygon-executor",
    resources: sizes.medium,
    env: {
      "RPC_SERVICE_URL": "http://integra-rpc-service:3000"
    }
  },
  {
    name: "integra-arbitrum-executor",
    namespace: namespaces.blockchain,
    replicas: 1,
    image: "integra-arbitrum-executor",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-arbitrum-executor",
    resources: sizes.small,
    env: {
      "RPC_SERVICE_URL": "http://integra-rpc-service:3000"
    }
  },
  {
    name: "integra-avalanche-executor",
    namespace: namespaces.blockchain,
    replicas: 1,
    image: "integra-avalanche-executor",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-avalanche-executor",
    resources: sizes.small,
    env: {
      "RPC_SERVICE_URL": "http://integra-rpc-service:3000"
    }
  },
  {
    name: "integra-base-executor",
    namespace: namespaces.blockchain,
    replicas: 1,
    image: "integra-base-executor",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-base-executor",
    resources: sizes.small,
    env: {
      "RPC_SERVICE_URL": "http://integra-rpc-service:3000"
    }
  },

  // Workflow Services
  {
    name: "integra-temporal-orchestrator-service",
    namespace: namespaces.workflow,
    replicas: 2,
    image: "integra-temporal-orchestrator-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-temporal-orchestrator-service",
    resources: sizes.large
  },
  {
    name: "integra-temporal-messaging-service",
    namespace: namespaces.workflow,
    replicas: 2,
    image: "integra-temporal-messaging-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-temporal-messaging-service",
    resources: sizes.medium
  },
  {
    name: "integra-messaging-service",
    namespace: namespaces.workflow,
    replicas: 2,
    image: "integra-messaging-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-messaging-service",
    resources: sizes.medium
  },
  {
    name: "integra-workflow-service",
    namespace: namespaces.workflow,
    replicas: 2,
    image: "integra-workflow-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-workflow-service",
    resources: sizes.medium
  },

  // Gateway Service
  {
    name: "integra-ai-gateway-service",
    namespace: namespaces.apps,
    replicas: 2,
    image: "integra-ai-gateway-service",
    port: 3000,
    healthCheck: "/health",
    infisicalPath: "/apps/integra-ai-gateway-service",
    resources: sizes.medium
  }
];

export function getServiceConfig(name: string): ServiceConfig | undefined {
  return serviceRegistry.find(s => s.name === name);
}

export function getServicesByNamespace(namespace: string): ServiceConfig[] {
  return serviceRegistry.filter(s => s.namespace === namespace);
}