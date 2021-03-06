import { filter, matches } from "lodash";
import { Kube } from "./Kube";
import { ResourceKind } from "./ResourceKinds";
import { IClusterServiceVersionCRDResource, IK8sList, IResource } from "./types";

export function fromCRD(
  r: IClusterServiceVersionCRDResource,
  namespace: string,
  ownerReference: any,
) {
  const resource = {
    apiVersion: Kube.resourceAPIVersion(r.kind as ResourceKind),
    kind: r.kind,
    metadata: {
      name: r.name,
    },
  } as IResource;
  return new ResourceRef(resource, namespace, { metadata: { ownerReferences: [ownerReference] } });
}

// ResourceRef defines a reference to a namespaced Kubernetes API Object and
// provides helpers to retrieve the resource URL
class ResourceRef {
  public apiVersion: string;
  public kind: ResourceKind;
  public name: string;
  public namespace: string;
  public filter: any;

  // Creates a new ResourceRef instance from an existing IResource. Provide
  // defaultNamespace to set if the IResource doesn't specify a namespace.
  // TODO: add support for cluster-scoped resources, or add a ClusterResourceRef
  // class.
  constructor(r: IResource, defaultNamespace?: string, defaultFilter?: any) {
    this.apiVersion = r.apiVersion;
    this.kind = r.kind;
    this.name = r.metadata.name;
    const namespace = r.metadata.namespace || defaultNamespace;
    if (!namespace) {
      throw new Error(`Namespace missing for resource ${this.name}, define a default namespace`);
    }
    this.namespace = namespace;
    this.filter = defaultFilter;
    return this;
  }

  // Gets a full resource URL for the referenced resource
  public getResourceURL() {
    return Kube.getResourceURL(
      this.apiVersion,
      Kube.resourcePlural(this.kind),
      this.namespace,
      this.name,
    );
  }

  public watchResourceURL() {
    return Kube.watchResourceURL(
      this.apiVersion,
      Kube.resourcePlural(this.kind),
      this.namespace,
      this.name,
    );
  }

  public async getResource() {
    const resource = await Kube.getResource(
      this.apiVersion,
      Kube.resourcePlural(this.kind),
      this.namespace,
      this.name,
    );
    const resourceList = resource as IK8sList<IResource, {}>;
    if (resourceList.items) {
      resourceList.items = filter(resourceList.items, matches(this.filter));
      return resourceList;
    }
    return resource;
  }

  // Opens and returns a WebSocket for the requested resource. Note: it is
  // important that this socket be properly closed when no longer needed. The
  // returned WebSocket can be attached to an event listener to read data from
  // the socket.
  public watchResource() {
    return Kube.watchResource(
      this.apiVersion,
      Kube.resourcePlural(this.kind),
      this.namespace,
      this.name,
    );
  }
}

export default ResourceRef;
