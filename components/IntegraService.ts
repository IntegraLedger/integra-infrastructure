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
    super("integra:service:IntegraService", name, {}, opts);

    const labels = {
      app: args.name,
      environment: args.environment,
      "app.kubernetes.io/name": args.name,
      "app.kubernetes.io/managed-by": "pulumi",
      "app.kubernetes.io/environment": args.environment,
    };

    // Create InfisicalSecret for automatic secret injection
    // Using standard service token authentication as per Infisical documentation
    this.infisicalSecret = new k8s.apiextensions.CustomResource(
      `${name}-infisical`,
      {
        apiVersion: "secrets.infisical.com/v1alpha1",
        kind: "InfisicalSecret",
        metadata: {
          name: `${args.name}-secrets`,
          namespace: args.namespace,
          labels,
        },
        spec: {
          hostAPI: "https://app.infisical.com/api",
          resyncInterval: 60,
          authentication: {
            serviceToken: {
              serviceTokenSecretReference: {
                secretName: "infisical-service-token",
                secretNamespace: args.namespace,
              },
              secretsScope: {
                envSlug: args.environment,
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
            // Removed deployment.kubernetes.io/revision - this is managed by Kubernetes controller
            "pulumi.com/autoUpdate": "true",
            "integra.io/deployed-at": new Date().toISOString(),
            "integra.io/deployed-by": "pulumi-automation",
            "integra.io/commit-sha": commitSha,
            "integra.io/service-name": args.name,
            "integra.io/image-tag": imageTag, // Track version differently
          },
        },
        spec: {
          replicas: args.replicas,
          selector: { matchLabels: labels },
          template: {
            metadata: { 
              labels: enhancedLabels,
              annotations: {
                "linkerd.io/inject": "enabled",
                "prometheus.io/scrape": "true",
                "prometheus.io/port": args.port.toString(),
                "prometheus.io/path": "/metrics",
                "integra.io/version": imageTag,
                "integra.io/commit": commitSha,
              },
            },
            spec: {
              containers: [
                {
                  name: args.name,
                  image: args.image,
                  imagePullPolicy: "Always",
                  ports: [{ containerPort: args.port, name: "http" }],
                  envFrom: [
                    {
                      secretRef: {
                        name: `${args.name}-env`,
                        optional: true,
                      },
                    },
                  ],
                  env: args.env ? Object.entries(args.env).map(([name, value]) => ({ name, value })) : [],
                  resources: args.resources,
                  livenessProbe: args.healthCheck
                    ? {
                        httpGet: {
                          path: args.healthCheck,
                          port: "http",
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
                          port: "http",
                        },
                        initialDelaySeconds: 10,
                        periodSeconds: 5,
                        timeoutSeconds: 3,
                        failureThreshold: 3,
                      }
                    : undefined,
                },
              ],
              imagePullSecrets: [
                {
                  name: "integra-registry",
                },
              ],
            },
          },
        },
      },
      { parent: this, dependsOn: [this.infisicalSecret] }
    );

    // Create Service
    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: args.name,
          namespace: args.namespace,
          labels: enhancedLabels,
          annotations: {
            "integra.io/service-version": imageTag,
          },
        },
        spec: {
          type: "ClusterIP",
          selector: labels,
          ports: [
            {
              port: args.port,
              targetPort: args.port,
              protocol: "TCP",
              name: "http",
            },
          ],
        },
      },
      { parent: this }
    );

    // Create APISIX Route if domain is specified
    if (args.domain && args.exposedPaths) {
      this.route = new k8s.apiextensions.CustomResource(
        `${name}-route`,
        {
          apiVersion: "apisix.apache.org/v2",
          kind: "ApisixRoute",
          metadata: {
            name: args.name,
            namespace: args.namespace,
          },
          spec: {
            http: [
              {
                name: args.name,
                match: {
                  hosts: [args.domain],
                  paths: args.exposedPaths,
                },
                backends: [
                  {
                    serviceName: args.name,
                    servicePort: args.port,
                  },
                ],
                plugins: [
                  {
                    name: "cors",
                    enable: true,
                    config: {
                      allow_origins: "http://localhost:3000,https://*.trustwithintegra.com",
                      allow_methods: "GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH",
                      allow_headers: "*",
                      expose_headers: "*",
                      allow_credentials: true,
                      max_age: 3600,
                    },
                  },
                ],
              },
            ],
          },
        },
        { parent: this, dependsOn: [this.service] }
      );
    }

    this.registerOutputs({
      deployment: this.deployment,
      service: this.service,
      infisicalSecret: this.infisicalSecret,
      route: this.route,
    });
  }
}