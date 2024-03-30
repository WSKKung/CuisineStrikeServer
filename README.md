# Cuisine Strike Backend Server
This is a backend server for a trading card game about chef battling using their food-theme creatures.

## Server Requirement:
- Docker
- NodeJS
- TypeScript

## Setup Project:
- Run `npm install` for first-time only project setup.
- Create new file named `docker-compose.yml` by copying from template file `docker-compose-template.yml`, you then can configure how the container should be run.
	See: [Docker Compose - Nakama Documentation](https://heroiclabs.com/docs/nakama/getting-started/install/docker/)
- Create new file named `local.yml` by copying from template file `local-template.yml`, you then can configure how the Nakama server should be run.
	See: [Configuration - Nakama Documentation](https://heroiclabs.com/docs/nakama/getting-started/configuration/#example-file)

## Run server:
- Use `docker compose up` to build and run the container

## Data setup
1. Go to Nakama Console after running the server
2. Go to Configuration
3. Upload every files inside `data` to insert necessary default data to server.

## Author
Sahachai Plangrit