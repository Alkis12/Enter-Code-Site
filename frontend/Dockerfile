FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps

COPY . .

CMD ["npm", "start"]
