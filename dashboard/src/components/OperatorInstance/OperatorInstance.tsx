import { RouterAction } from "connected-react-router";
import * as yaml from "js-yaml";
import * as React from "react";

import AccessURLTable from "../../containers/AccessURLTableContainer";
import ApplicationStatus from "../../containers/ApplicationStatusContainer";
import placeholder from "../../placeholder.png";
import { fromCRD } from "../../shared/ResourceRef";
import { IClusterServiceVersion, IClusterServiceVersionCRD, IResource } from "../../shared/types";
import AppNotes from "../AppView/AppNotes";
import AppValues from "../AppView/AppValues";
import { IPartialAppViewState } from "../AppView/AppView";
import ResourceTable from "../AppView/ResourceTable";
import Card, { CardContent, CardFooter, CardGrid, CardIcon } from "../Card";
import ConfirmDialog from "../ConfirmDialog";
import { ErrorSelector } from "../ErrorAlert";
import LoadingWrapper from "../LoadingWrapper";

export interface IOperatorInstanceProps {
  isFetching: boolean;
  namespace: string;
  csvName: string;
  crdName: string;
  instanceName: string;
  getResource: (
    namespace: string,
    csvName: string,
    crdName: string,
    resourceName: string,
  ) => Promise<void>;
  deleteResource: (namespace: string, crdName: string, resource: IResource) => Promise<boolean>;
  push: (location: string) => RouterAction;
  error?: Error;
  resource?: IResource;
  csv?: IClusterServiceVersion;
}

export interface IOperatorInstanceState {
  modalIsOpen: boolean;
  crd?: IClusterServiceVersionCRD;
  resources?: IPartialAppViewState;
}

class OperatorInstance extends React.Component<IOperatorInstanceProps, IOperatorInstanceState> {
  public state: IOperatorInstanceState = {
    modalIsOpen: false,
  };

  public componentDidMount() {
    const { csvName, crdName, instanceName, namespace, getResource } = this.props;
    getResource(namespace, csvName, crdName, instanceName);
  }

  public componentDidUpdate(prevProps: IOperatorInstanceProps) {
    const { csvName, crdName, instanceName, namespace, getResource, resource, csv } = this.props;
    if (prevProps.namespace !== namespace) {
      getResource(namespace, csvName, crdName, instanceName);
      return;
    }
    let crd = this.state.crd;
    if (csv !== prevProps.csv || resource !== prevProps.resource) {
      if (csv && resource) {
        crd = csv.spec.customresourcedefinitions.owned.find(c => c.kind === resource.kind);
        this.setState({ crd });
      }
      if (crd && resource) {
        const result: IPartialAppViewState = {
          ingressRefs: [],
          deployRefs: [],
          statefulSetRefs: [],
          daemonSetRefs: [],
          otherResources: [],
          serviceRefs: [],
          secretRefs: [],
        };
        const ownerRef = { name: resource.metadata.name, kind: resource.kind };
        crd.resources.forEach(r => {
          switch (r.kind) {
            case "Deployment":
              result.deployRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            case "StatefulSet":
              result.statefulSetRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            case "DaemonSet":
              result.daemonSetRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            case "Service":
              result.serviceRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            case "Ingress":
              result.ingressRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            case "Secret":
              result.secretRefs.push(fromCRD(r, this.props.namespace, ownerRef));
              break;
            default:
              result.otherResources.push(fromCRD(r, this.props.namespace, ownerRef));
          }
        });
        this.setState({ resources: result });
      }
    }
  }

  public render() {
    const { isFetching, error, resource, csv, instanceName, namespace } = this.props;
    const { resources } = this.state;
    return (
      <section className="AppView padding-b-big">
        <main>
          <LoadingWrapper loaded={!isFetching}>
            {error && (
              <ErrorSelector
                error={error}
                action="get"
                resource={`Operator intance ${instanceName}`}
                namespace={namespace}
              />
            )}
            {resource && (
              <div className="row collapse-b-tablet">
                <div className="col-3">{csv && this.renderCSVInfo(csv)}</div>
                <div className="col-9">
                  <div className="row padding-t-bigger">
                    <div className="col-4">
                      {resources && (
                        <ApplicationStatus
                          deployRefs={resources.deployRefs}
                          statefulsetRefs={resources.statefulSetRefs}
                          daemonsetRefs={resources.daemonSetRefs}
                        />
                      )}
                    </div>
                    <div className="col-8 text-r">
                      <button className="button button-danger" onClick={this.openModal}>
                        Delete
                      </button>
                      <ConfirmDialog
                        onConfirm={this.handleDeleteClick}
                        modalIsOpen={this.state.modalIsOpen}
                        loading={this.props.isFetching}
                        closeModal={this.closeModal}
                      />
                    </div>
                  </div>
                  {resources && (
                    <>
                      <AccessURLTable
                        serviceRefs={resources.serviceRefs}
                        ingressRefs={resources.ingressRefs}
                      />
                      <AppNotes title="Status" notes={yaml.safeDump(resource.status)} />
                      <ResourceTable resourceRefs={resources.secretRefs} title="Secrets" />
                      <ResourceTable resourceRefs={resources.deployRefs} title="Deployments" />
                      <ResourceTable
                        resourceRefs={resources.statefulSetRefs}
                        title="StatefulSets"
                      />
                      <ResourceTable resourceRefs={resources.daemonSetRefs} title="DaemonSets" />
                      <ResourceTable resourceRefs={resources.serviceRefs} title="Services" />
                      <AppValues values={yaml.safeDump(resource.spec)} />
                      {/* TODO(andresmgot): Enable otherResourcesTable when they are fetched */}
                      {/* <ResourceTable
                        resourceRefs={resources.otherResources}
                        title="Other Resources"
                      /> */}
                    </>
                  )}
                </div>
              </div>
            )}
          </LoadingWrapper>
        </main>
      </section>
    );
  }

  private renderCSVInfo = (csv: IClusterServiceVersion) => {
    const { instanceName } = this.props;
    const { crd } = this.state;
    const icon = csv.spec.icon.length
      ? `data:${csv.spec.icon[0].mediatype};base64,${csv.spec.icon[0].base64data}`
      : placeholder;
    return (
      <CardGrid className="ChartInfo">
        <Card>
          <CardIcon icon={icon} />
          <CardContent>
            <h5>{instanceName}</h5>
            <p className="margin-b-reset">{crd?.description}</p>
          </CardContent>
          <CardFooter>
            <div>
              <div>Cluster Service Version: v{csv.spec.version}</div>
              <div>Kind: {crd?.kind}</div>
            </div>
          </CardFooter>
        </Card>
      </CardGrid>
    );
  };

  private openModal = () => {
    this.setState({
      modalIsOpen: true,
    });
  };

  private closeModal = async () => {
    this.setState({
      modalIsOpen: false,
    });
  };

  private handleDeleteClick = async () => {
    const { namespace, resource } = this.props;
    const { crd } = this.state;
    const deleted = await this.props.deleteResource(namespace, crd!.name.split(".")[0], resource!);
    this.closeModal();
    if (deleted) {
      this.props.push(`/apps/ns/${namespace}`);
    }
  };
}

export default OperatorInstance;
