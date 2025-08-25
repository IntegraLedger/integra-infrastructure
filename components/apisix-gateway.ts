import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";

export interface APISIXGatewayArgs {
  namespace?: string;
  replicas?: {
    gateway?: number;
    controller?: number;
    etcd?: number;
  };
  loadBalancerIP?: string;
  environment: "dev" | "staging" | "prod";
}

export class APISIXGateway extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly release: k8s.helm.v3.Release;
  public readonly loadBalancerIP: pulumi.Output<string>;
  public readonly adminKey: pulumi.Output<string>;

  constructor(
    name: string,
    args: APISIXGatewayArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("integra:infrastructure:APISIXGateway", name, {}, opts);

    // Create namespace
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: args.namespace || "apisix",
          labels: {
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "api-gateway",
            "app.kubernetes.io/part-of": "integra-platform",
          },
        },
      },
      { parent: this }
    );

    // Generate secure admin key
    const adminKeyResource = new random.RandomPassword(
      `${name}-admin-key`,
      {
        length: 32,
        special: false,
      },
      { parent: this }
    );
    this.adminKey = adminKeyResource.result;

    // Generate etcd root password
    const etcdPassword = new random.RandomPassword(
      `${name}-etcd-password`,
      {
        length: 24,
        special: true,
      },
      { parent: this }
    );

    // Production-ready configuration
    const isProd = args.environment === "prod";
    const replicas = {
      gateway: args.replicas?.gateway || (isProd ? 3 : 1),
      controller: args.replicas?.controller || (isProd ? 2 : 1),
      etcd: args.replicas?.etcd || 3,
    };

    // Deploy APISIX via Helm
    this.release = new k8s.helm.v3.Release(
      `${name}-helm`,
      {
        chart: "apisix",
        version: "2.11.5",
        namespace: this.namespace.metadata.name,
        createNamespace: false,
        repositoryOpts: {
          repo: "https://charts.apiseven.com",
        },
        values: {
          apisix: {
            replicaCount: replicas.gateway,
            image: {
              repository: "apache/apisix",
              tag: "3.13.0-debian",
              pullPolicy: "IfNotPresent",
            },
            podAnnotations: {
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "9091",
              "prometheus.io/path": "/apisix/prometheus/metrics",
            },
            admin: {
              enabled: true,
              key: this.adminKey,
              allow: {
                ipList: ["10.0.0.0/8", "127.0.0.1/24"], // Internal only
              },
            },
            ssl: {
              enabled: true,
              sslProtocols: "TLSv1.2 TLSv1.3",
            },
            resources: {
              requests: {
                cpu: isProd ? "500m" : "100m",
                memory: isProd ? "512Mi" : "256Mi",
              },
              limits: {
                cpu: isProd ? "2000m" : "500m",
                memory: isProd ? "2Gi" : "512Mi",
              },
            },
            autoscaling: {
              enabled: isProd,
              minReplicas: replicas.gateway,
              maxReplicas: 10,
              targetCPUUtilizationPercentage: 80,
              targetMemoryUtilizationPercentage: 80,
            },
            podDisruptionBudget: {
              enabled: isProd,
              minAvailable: 1,
            },
            customPlugins: {
              enabled: true,
              luaPath: "/usr/local/apisix/?.lua",
              plugins: [
                {
                  name: "integra-auth",
                  attrs: {},
                  configMap: {
                    name: "apisix-custom-plugins",
                    mounts: [
                      {
                        key: "integra-auth.lua",
                        path: "/usr/local/apisix/plugins/integra-auth.lua",
                      },
                    ],
                  },
                },
              ],
            },
          },
          gateway: {
            type: "LoadBalancer",
            annotations: {
              "service.beta.kubernetes.io/do-loadbalancer-type": "REGIONAL",
              ...(args.loadBalancerIP && {
                "service.beta.kubernetes.io/do-loadbalancer-floating-ip":
                  args.loadBalancerIP,
              }),
              "service.beta.kubernetes.io/do-loadbalancer-enable-proxy-protocol": "false",
              "service.beta.kubernetes.io/do-loadbalancer-algorithm": "round_robin",
              "service.beta.kubernetes.io/do-loadbalancer-healthcheck-path": "/healthz",
              "service.beta.kubernetes.io/do-loadbalancer-healthcheck-protocol": "http",
              "service.beta.kubernetes.io/do-loadbalancer-healthcheck-port": "80",
            },
            tls: {
              enabled: true,
              servicePort: 443,
              containerPort: 9443,
            },
          },
          etcd: {
            enabled: true,
            replicaCount: replicas.etcd,
            auth: {
              rbac: {
                create: true,
                rootPassword: etcdPassword.result,
              },
              tls: {
                enabled: isProd,
                autoGenerated: true,
              },
            },
            resources: {
              requests: {
                cpu: isProd ? "250m" : "100m",
                memory: isProd ? "512Mi" : "256Mi",
              },
              limits: {
                cpu: isProd ? "1000m" : "250m",
                memory: isProd ? "1Gi" : "512Mi",
              },
            },
            persistence: {
              enabled: true,
              size: isProd ? "10Gi" : "2Gi",
              storageClass: "do-block-storage",
            },
          },
          "ingress-controller": {
            enabled: true,
            replicaCount: replicas.controller,
            image: {
              repository: "apache/apisix-ingress-controller",
              tag: "1.8.2",
            },
            config: {
              apisix: {
                serviceNamespace: this.namespace.metadata.name,
                adminAPIVersion: "v3",
                baseURL: pulumi.interpolate`http://apisix-admin.${this.namespace.metadata.name}.svc.cluster.local:9180`,
                adminKey: this.adminKey,
              },
              ingressClass: "apisix",
              createIngressClass: true,
              defaultRouteAnnotations: {
                "prometheus.io/scrape": "true",
              },
            },
            resources: {
              requests: {
                cpu: isProd ? "250m" : "100m",
                memory: isProd ? "256Mi" : "128Mi",
              },
              limits: {
                cpu: isProd ? "1000m" : "250m",
                memory: isProd ? "512Mi" : "256Mi",
              },
            },
            autoscaling: {
              enabled: isProd,
              minReplicas: replicas.controller,
              maxReplicas: 5,
              targetCPUUtilizationPercentage: 80,
            },
          },
          dashboard: {
            enabled: false, // Security: never enable in production
          },
          metrics: {
            enabled: true,
            serviceMonitor: {
              enabled: true,
              namespace: this.namespace.metadata.name,
              interval: "30s",
            },
          },
        },
      },
      { parent: this, dependsOn: [this.namespace] }
    );

    // Get the LoadBalancer service
    const gatewaySvc = k8s.core.v1.Service.get(
      `${name}-gateway-svc`,
      pulumi.interpolate`${this.namespace.metadata.name}/apisix-gateway`,
      { parent: this, dependsOn: [this.release] }
    );

    this.loadBalancerIP = gatewaySvc.status.apply(
      (status) => status?.loadBalancer?.ingress?.[0]?.ip || "pending"
    );

    // Create NetworkPolicy for security
    if (isProd) {
      new k8s.networking.v1.NetworkPolicy(
        `${name}-network-policy`,
        {
          metadata: {
            name: "apisix-network-policy",
            namespace: this.namespace.metadata.name,
          },
          spec: {
            podSelector: {
              matchLabels: {
                "app.kubernetes.io/name": "apisix",
              },
            },
            policyTypes: ["Ingress", "Egress"],
            ingress: [
              {
                from: [
                  {
                    namespaceSelector: {
                      matchLabels: {
                        name: "integra-apps",
                      },
                    },
                  },
                  {
                    namespaceSelector: {
                      matchLabels: {
                        name: "integra-blockchain",
                      },
                    },
                  },
                  {
                    namespaceSelector: {
                      matchLabels: {
                        name: "integra-workflow",
                      },
                    },
                  },
                ],
                ports: [
                  { protocol: "TCP", port: 80 },
                  { protocol: "TCP", port: 443 },
                  { protocol: "TCP", port: 9180 }, // Admin API
                ],
              },
            ],
            egress: [
              {
                to: [
                  {
                    namespaceSelector: {},
                  },
                ],
                ports: [
                  { protocol: "TCP", port: 53 }, // DNS
                  { protocol: "UDP", port: 53 }, // DNS
                  { protocol: "TCP", port: 443 }, // HTTPS
                  { protocol: "TCP", port: 3000 }, // App services
                ],
              },
            ],
          },
        },
        { parent: this }
      );
    }

    // Export important values
    this.registerOutputs({
      namespace: this.namespace,
      release: this.release,
      loadBalancerIP: this.loadBalancerIP,
      adminKey: pulumi.secret(this.adminKey),
    });
  }

  // Helper method to create routes
  public createRoute(
    name: string,
    domain: string,
    paths: string[],
    backend: {
      serviceName: string;
      servicePort: number;
      namespace: string;
    },
    plugins?: any[]
  ): k8s.apiextensions.CustomResource {
    return new k8s.apiextensions.CustomResource(
      `${name}-route`,
      {
        apiVersion: "apisix.apache.org/v2",
        kind: "ApisixRoute",
        metadata: {
          name,
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "route",
            "integra.io/service": backend.serviceName,
          },
        },
        spec: {
          http: [
            {
              name,
              match: {
                hosts: [domain],
                paths,
              },
              backends: [
                {
                  serviceName: `${backend.serviceName}.${backend.namespace}.svc.cluster.local`,
                  servicePort: backend.servicePort,
                  weight: 100,
                },
              ],
              plugins: plugins || [
                {
                  name: "cors",
                  enable: true,
                  config: {
                    allow_origins: "https://*.trustwithintegra.com,http://localhost:3000,http://localhost:5173",
                    allow_methods: "GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH",
                    allow_headers: "*",
                    expose_headers: "*",
                    allow_credentials: true,
                    max_age: 3600,
                  },
                },
                {
                  name: "prometheus",
                  enable: true,
                },
              ],
            },
          ],
        },
      },
      { parent: this, dependsOn: [this.release] }
    );
  }

  // Create TLS configuration
  public createTLS(
    certSecretName: string,
    certSecretNamespace: string,
    hosts: string[]
  ): k8s.apiextensions.CustomResource {
    return new k8s.apiextensions.CustomResource(
      `${certSecretName}-tls`,
      {
        apiVersion: "apisix.apache.org/v2",
        kind: "ApisixTls",
        metadata: {
          name: certSecretName,
          namespace: this.namespace.metadata.name,
        },
        spec: {
          hosts,
          secret: {
            name: certSecretName,
            namespace: certSecretNamespace,
          },
        },
      },
      { parent: this, dependsOn: [this.release] }
    );
  }
}