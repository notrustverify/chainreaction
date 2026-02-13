FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production && yarn add tsx

COPY server.ts tsconfig.json ./

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "--import", "tsx", "server.ts"]
