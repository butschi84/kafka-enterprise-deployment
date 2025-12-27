# Kafka Cluster on Google Kubernetes Engine (GKE)

A production-ready Kafka cluster deployment on Google Kubernetes Engine using Strimzi Kafka Operator with KRaft mode, OAuth authentication, and enterprise features.

## Features

* **KRaft Mode (No Zookeeper)**
  * Kafka 4.1.0 with KRaft mode enabled
  * Controller and broker roles combined
* **OAuth Authentication**
  * Keycloak/OpenID Connect integration
  * Bearer token authentication
* **TLS Encryption**
  * Mutual TLS for client authentication
  * External LoadBalancer with TLS
* **Enterprise Features**
  * Cruise Control for cluster optimization
  * Entity Operator (Topic & User operators)
  * Pod anti-affinity for high availability
  * Persistent storage

## Prerequisites

- Google Cloud Platform (GCP) account
- `gcloud` CLI installed and configured
- `kubectl` CLI installed
- `helm` CLI v3+ installed
- Access to a GKE cluster (or permissions to create one)
- Keycloak server with OAuth configuration
- Kubernetes secret with OAuth client credentials

## Quick Start

### 1. Create GKE Cluster (if needed)

```bash
gcloud container clusters create kafka-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 6
```

### 2. Configure kubectl

```bash
gcloud container clusters get-credentials kafka-cluster --zone us-central1-a
```

### 3. Create OAuth Secret

Create a Kubernetes secret with your Keycloak OAuth client credentials:

```bash
kubectl create namespace kafka
kubectl create secret generic kafka-oauth-client-secret \
  --from-literal=client-secret=YOUR_CLIENT_SECRET \
  -n kafka
```

### 4. Deploy Kafka Cluster

```bash
cd helm-chart
helm dependency update
helm install kafka-cluster . -n kafka
```

### 5. Verify Deployment

```bash
# Check Strimzi operator
kubectl get pods -n kafka

# Check Kafka cluster
kubectl get kafka -n kafka

# Check Kafka pods
kubectl get pods -n kafka -l strimzi.io/cluster=kafka-cluster
```

## Configuration

### Key Configuration Files

- `helm-chart/values.yaml` - Main configuration file
- `helm-chart/templates/kafka-cluster.yaml` - Kafka cluster definition
- `helm-chart/templates/kafka-topic.yaml` - Topic definitions
- `helm-chart/templates/kafka-user.yaml` - User definitions

### Important Settings

**OAuth Configuration** (in `values.yaml`):
```yaml
kafka:
  oauth:
    enabled: true
    tokenEndpointUri: "https://auth.opensight.ch/auth/realms/master/protocol/openid-connect/token"
    clientId: "kafka-broker"
    clientSecretName: "kafka-oauth-client-secret"
    validIssuerUri: "https://auth.opensight.ch/auth/realms/master"
    jwksEndpointUri: "https://auth.opensight.ch/auth/realms/master/protocol/openid-connect/certs"
```

**LoadBalancer Configuration**:
```yaml
kafka:
  listeners:
    external:
      enabled: true
      type: "loadbalancer"
      tls: true
      requireClientCert: true
      authentication:
        type: "oauth"
```

## Accessing Kafka

### Get LoadBalancer IPs

```bash
# Bootstrap LoadBalancer
kubectl get svc kafka-cluster-kafka-external-bootstrap -n kafka

# Per-broker LoadBalancers
kubectl get svc -n kafka -l strimzi.io/cluster=kafka-cluster
```

### Connection Details

- **Bootstrap Server**: `<loadbalancer-ip>:9094`
- **Security Protocol**: `SASL_SSL`
- **SASL Mechanism**: `OAUTHBEARER`
- **TLS**: Required (mutual TLS with client certificates)

## Management

### Create Topics

Topics can be managed via the KafkaTopic CRD or through the Kafka CLI:

```bash
kubectl apply -f - <<EOF
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: my-topic
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  partitions: 3
  replicas: 3
  config:
    retention.ms: 7200000
EOF
```

### Create Users

Users can be managed via the KafkaUser CRD:

```bash
kubectl apply -f - <<EOF
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaUser
metadata:
  name: my-user
  namespace: kafka
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  authentication:
    type: tls
  authorization:
    type: simple
    acls:
      - resource:
          type: topic
          name: "*"
          patternType: literal
        operations:
          - All
EOF
```

### Cruise Control

Cruise Control is automatically deployed for cluster optimization. Access it via:

```bash
kubectl port-forward svc/kafka-cluster-cruise-control -n kafka 9090:9090
```

Then access the UI at `http://localhost:9090`

## Troubleshooting

### Check Pod Logs

```bash
# Strimzi operator logs
kubectl logs -n kafka -l name=strimzi-cluster-operator

# Kafka broker logs
kubectl logs -n kafka kafka-cluster-kafka-0
```

### Check Events

```bash
kubectl get events -n kafka --sort-by='.lastTimestamp'
```

### Common Issues

1. **OAuth Secret Missing**: Ensure the secret `kafka-oauth-client-secret` exists in the `kafka` namespace
2. **LoadBalancer Not Ready**: Check GCP quotas and ensure LoadBalancer services are being created
3. **Pod Scheduling Issues**: Verify node resources and anti-affinity rules

## Cleanup

```bash
# Uninstall Helm release
helm uninstall kafka-cluster -n kafka

# Delete namespace (removes all resources)
kubectl delete namespace kafka

# Delete GKE cluster (if needed)
gcloud container clusters delete kafka-cluster --zone us-central1-a
```

## Resources

- [Strimzi Documentation](https://strimzi.io/documentation/)
- [Kafka KRaft Mode](https://kafka.apache.org/documentation/#kraft)
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)

