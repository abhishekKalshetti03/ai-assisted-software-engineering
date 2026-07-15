# Azure Container Apps deployment

This repository includes a GitHub Actions workflow for Azure Container Apps at [.github/workflows/deploy-azure-container-apps.yml](.github/workflows/deploy-azure-container-apps.yml).

## Prerequisites

- An Azure subscription
- An Azure Container Registry
- A resource group for the Container App
- The following GitHub secrets:
  - AZURE_CLIENT_ID
  - AZURE_TENANT_ID
  - AZURE_SUBSCRIPTION_ID

## Notes

Update the environment variables at the top of the workflow to match your Azure environment:
- AZURE_CONTAINER_APP_NAME
- AZURE_RESOURCE_GROUP
- AZURE_LOCATION
- AZURE_CONTAINER_REGISTRY

The workflow builds the container image, pushes it to ACR, and deploys the app as an external Container App on port 3000.
