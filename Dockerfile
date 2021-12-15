FROM node:12-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json /app
RUN apt-get update
RUN apt-get install -y openssl python make g++
RUN npm install
COPY . /app
CMD [ "node", "server.js" ]