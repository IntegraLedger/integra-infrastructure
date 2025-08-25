import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface IntegraServiceArgs {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  port: number;
  healthCheck?: string;
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  infisicalPath: string;
  environment: string;
  domain?: string;
  exposedPaths?: string[];
  env?: Record<string, string>;
}

export class IntegraService extends pulumi.ComponentResource {
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly infisicalSecret: k8s.apiextensions.CustomResource;
  public readonly route?: k8s.apiextensions.CustomResource;

  constructor(
    name: string,
    args: IntegraServiceArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("integra:service", name, {}, opts);

    const labels = {
      app: args.name,
      environment: args.environment,
      "app.kubernetes.io/name": args.name,
      "app.kubernetes.io/managed-by": "pulumi",
      "app.kubernetes.io/environment": args.environment,
    };

    // Create InfisicalSecret for automatic secret injection
    // Using universal auth with PROJECT ID (not slug)
    this.infisicalSecret = new k8s.apiextensions.CustomResource(
      `${name}-env`,
      {
        apiVersion: "secrets.infisical.com/v1alpha1",
        kind: "InfisicalSecret",
        metadata: {
          name: `${args.name}-env`,
          namespace: args.namespace,
          labels,
        },
        spec: {
          hostAPI: "https://app.infisical.com/api",
          resyncInterval: 60,
          authentication: {
            universalAuth: {
              credentialsRef: {
                secretName: "infisical-auth",
                secretNamespace: args.namespace,
              },
              secretsScope: {
                envSlug: args.environment,
                // Use the actual project ID from Infisical
                projectId: "acd53ca1-6365-4874-874f-15d62453c34f",
                secretsPath: args.infisicalPath,
              }
            }
          },
          managedSecretReference: {
            secretName: `${args.name}-env`,
            secretNamespace: args.namespace,
          },
        },
      },
      { parent: this }
    );

    // Extract version from image tag if present
    const imageTag = args.image.split(':')[1] || 'latest';
    const commitSha = imageTag.includes('-') ? imageTag.split('-')[1] : 'unknown';
    
    // Enhanced labels with version tracking
    const enhancedLabels = {
      ...labels,
      "app.kubernetes.io/version": imageTag,
      "app.kubernetes.io/component": "service",
    };

    // Create Deployment
    this.deployment = new k8s.apps.v1.Deployment(
      `${name}-deployment`,
      {
        metadata: {
          name: args.name,
          namespace: args.namespace,
          labels: enhancedLabels,
          annotations: {
            "linkerd.io/inject": "enabled",
            "pulumi.com/skipAwait": "true",
          },
        },
        spec: {
          replicas: args.replicas,
          selector: {
            matchLabels: {
              app: args.name,
            },
          },
          template: {
            metadata: {
              labels: {
                app: args.name,
                version: imageTag,
              },
              annotations: {
                "linkerd.io/inject": "enabled",
                "prometheus.io/scrape": "true",
                "prometheus.io/port": String(args.port),
                "prometheus.io/path": "/metrics",
                // Force redeployment when image changes
                "deployment.kubernetes.io/revision": imageTag,
                // Track commit SHA for traceability
                "app.kubernetes.io/commit": commitSha,
              },
            },
            spec: {
              serviceAccountName: "default",
              imagePullSecrets: [{ name: "integra-registry" }],
              containers: [
                {
                  name: "app",
                  image: args.image,
                  imagePullPolicy: "Always",
                  ports: [
                    {
                      containerPort: args.port,
                      name: "http",
                      protocol: "TCP",
                    },
                  ],
                  envFrom: [
                    {
                      secretRef: {
                        name: `${args.name}-env`,
                      },
                    },
                  ],
                  env: args.env ? Object.entries(args.env).map(([name, value]) => ({ name, value })) : [],
                  resources: args.resources,
                  livenessProbe: args.healthCheck
                    ? {
                        httpGet: {
                          path: args.healthCheck,
                          port: args.port,
                        },
                        initialDelaySeconds: 30,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                      }
                    : undefined,
                  readinessProbe: args.healthCheck
                    ? {
                        httpGet: {
                          path: args.healthCheck,
                          port: args.port,
                        },
                        initialDelaySeconds: 10,
                        periodSeconds: 5,
                        timeoutSeconds: 3,
                        failureThreshold: 3,
                      }
                    : undefined,
                },
              ],
              restartPolicy: "Always",
              terminationGracePeriodSeconds: 30,
            },
          },
          strategy: {
            type: "RollingUpdate",
            rollingUpdate: {
              maxSurge: 1,
              maxUnavailable: 0,
            },
          },
        },
      },
      { parent: this, deleteBeforeReplace: true }
    );

    // Create Service
    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: args.name,
          namespace: args.namespace,
          labels,
          annotations: {
            "prometheus.io/scrape": "true",
            "prometheus.io/port": String(args.port),
          },
        },
        spec: {
          selector: {
            app: args.name,
          },
          ports: [
            {
              port: args.port,
              targetPort: args.port,
              protocol: "TCP",
              name: "http",
            },
          ],
          type: "ClusterIP",
        },
      },
      { parent: this }
    );

    // Create APISIX route if domain is specified
    if (args.domain && args.exposedPaths) {
      this.route = new k8s.apiextensions.CustomResource(
        `${name}-route`,
        {
          apiVersion: "apisix.apache.org/v2",
          kind: "ApisixRoute",
          metadata: {
            name: args.name,
            namespace: args.namespace,
            labels,
          },
          spec: {
            http: args.exposedPaths.map((path, index) => ({
              name: `${args.name}-rule-${index}`,
              match: {
                hosts: [args.domain],
                paths: [path],
              },
              upstreams: [
                {
                  type: "service",
                  serviceName: args.name,
                  servicePort: args.port,
                },
              ],
            })),
          },
        },
        { parent: this }
      );
    }
  }
}