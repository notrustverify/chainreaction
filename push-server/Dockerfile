FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN yarn install --production && yarn add tsx

COPY server.ts tsconfig.json ./

EXPOSE 3001

CMD ["node", "--import", "tsx", "server.ts"]
