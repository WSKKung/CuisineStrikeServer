FROM node:alpine AS node-builder

WORKDIR /backend

# "Initializing Node package"
COPY package*.json .
RUN npm install

# "Copying configurations"
COPY tsconfig.json .

# "Copying source codes"
COPY index.ts .
COPY src ./src

# "Compiling source codes"
RUN npx tsc

FROM registry.heroiclabs.com/heroiclabs/nakama:3.19.0

# "Copying compiled runtime build to Nakama"
COPY --from=node-builder /backend/build/*.js /nakama/data/modules/build/

# "Copying server configuration to Nakama"
COPY local.yml .