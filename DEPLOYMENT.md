# Deployment Guide

## Container deployment

Build and run the app locally with Docker:

```bash
docker build -t url-shortener .
docker run -p 3000:3000 url-shortener
```

Or use Docker Compose:

```bash
docker compose up --build
```

## CI/CD

The repository includes:
- a GitHub Actions CI workflow at [.github/workflows/ci.yml](.github/workflows/ci.yml) that checks out the code, installs dependencies, runs the tests, and builds the application
- a deployment workflow stub at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) that can be extended for Azure, AWS, GCP, or another cloud provider
- an Azure Container Apps deployment workflow at [.github/workflows/deploy-azure-container-apps.yml](.github/workflows/deploy-azure-container-apps.yml) with the required Azure login and registry steps

See [deploy/azure-container-apps.md](deploy/azure-container-apps.md) for provider-specific prerequisites and setup details.

## Kubernetes and health probes

A basic Kubernetes deployment example is available at [deploy/k8s.yaml](deploy/k8s.yaml). It includes readiness and liveness probes against /health.

## Monitoring example

A sample Prometheus and Grafana setup is available in [deploy/prometheus-grafana.yml](deploy/prometheus-grafana.yml) and [deploy/prometheus.yml](deploy/prometheus.yml). This provides a starting point for metrics collection and visualization.
