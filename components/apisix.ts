import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export function setupAPISIX(namespace?: k8s.core.v1.Namespace) {
  // Note: This assumes APISIX is already installed via Helm
  // We're just getting the service to export the LoadBalancer IP
  
  const apisixService = k8s.core.v1.Service.get(
    "apisix-gateway",
    "apisix/apisix-gateway"
  );

  return {
    loadBalancerIP: apisixService.status.apply(
      status => status?.loadBalancer?.ingress?.[0]?.ip || "pending"
    ),
    service: apisixService
  };
}