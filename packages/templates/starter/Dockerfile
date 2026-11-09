FROM node:22-alpine
WORKDIR /bot
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
CMD ["npx", "makecord", "start", "."]
