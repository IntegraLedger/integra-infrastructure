import * as pulumi from "@pulumi/pulumi";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

export interface ServiceVersion {
  version: string;
  commit: string;
  deployed: string;
  buildUrl?: string;
}

export interface VersionManifest {
  metadata: {
    updated: string;
    updatedBy: string;
    environment: string;
  };
  services: Record<string, ServiceVersion>;
}

export class VersionManager {
  private manifest: VersionManifest;
  private manifestPath: string;
  private config: pulumi.Config;
  
  constructor(config: pulumi.Config) {
    this.config = config;
    // versions.yaml is in the root of the project
    this.manifestPath = path.join(process.cwd(), "versions.yaml");
    this.manifest = this.loadManifest();
  }
  
  private loadManifest(): VersionManifest {
    try {
      pulumi.log.info(`Loading versions.yaml from: ${this.manifestPath}`);
      const content = fs.readFileSync(this.manifestPath, "utf8");
      const manifest = yaml.load(content) as VersionManifest;
      pulumi.log.info(`Loaded ${Object.keys(manifest.services || {}).length} service versions`);
      return manifest;
    } catch (error) {
      pulumi.log.warn(`Failed to load versions.yaml from ${this.manifestPath}: ${error}`);
      return this.getDefaultManifest();
    }
  }
  
  private getDefaultManifest(): VersionManifest {
    return {
      metadata: {
        updated: new Date().toISOString(),
        updatedBy: "pulumi-automation",
        environment: this.config.require("environment"),
      },
      services: {},
    };
  }
  
  /**
   * Get the image tag for a service
   * Priority order:
   * 1. Runtime override from Pulumi config (for CI/CD updates)
   * 2. Version from versions.yaml
   * 3. Fallback to 'latest' (with warning)
   */
  public getImageTag(serviceName: string): string {
    // Check for runtime override from CI/CD
    const overrides = this.config.getObject<Record<string, string>>("imageOverrides");
    if (overrides && overrides[serviceName]) {
      pulumi.log.info(`Using override version for ${serviceName}: ${overrides[serviceName]}`);
      return overrides[serviceName];
    }
    
    // Check versions.yaml
    const serviceVersion = this.manifest.services[serviceName];
    if (serviceVersion && serviceVersion.version && serviceVersion.version !== "latest") {
      pulumi.log.info(`Using version from versions.yaml for ${serviceName}: ${serviceVersion.version}`);
      return serviceVersion.version;
    }
    
    // Log what we found for debugging
    pulumi.log.error(`Service ${serviceName} in manifest: ${JSON.stringify(serviceVersion)}`);
    
    // NO FALLBACK - FAIL FAST
    throw new Error(
      `No valid version found for service '${serviceName}'. ` +
      `Version must be specified in versions.yaml or via runtime override. ` +
      `Found: ${JSON.stringify(serviceVersion)}. ` +
      `'latest' tag is not allowed.`
    );
  }
  
  /**
   * Get full image URL for a service
   */
  public getImageUrl(serviceName: string, registry: string): string {
    const tag = this.getImageTag(serviceName);
    return `${registry}/${serviceName}:${tag}`;
  }
  
  /**
   * Get metadata for a service version
   */
  public getVersionMetadata(serviceName: string): ServiceVersion | undefined {
    return this.manifest.services[serviceName];
  }
  
  /**
   * Validate that all required services have versions
   */
  public validateVersions(requiredServices: string[]): void {
    const missing: string[] = [];
    
    for (const service of requiredServices) {
      const version = this.getImageTag(service);
      if (version === "latest") {
        missing.push(service);
      }
    }
    
    if (missing.length > 0) {
      pulumi.log.warn(`Services using 'latest' tag: ${missing.join(", ")}`);
    }
  }
  
  /**
   * Export version information for monitoring
   */
  public exportVersions(): pulumi.Output<Record<string, string>> {
    const versions: Record<string, string> = {};
    
    for (const [service, metadata] of Object.entries(this.manifest.services)) {
      versions[service] = metadata.version;
    }
    
    return pulumi.output(versions);
  }
}