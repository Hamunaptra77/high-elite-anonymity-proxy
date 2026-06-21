FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN apk add --no-cache curl \
	&& npm install --omit=dev
COPY server.js ./
COPY public ./public

EXPOSE 8088
CMD ["npm", "start"]
