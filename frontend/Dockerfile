FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . ./

EXPOSE 6000

ENV PORT 6000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "dev"]
