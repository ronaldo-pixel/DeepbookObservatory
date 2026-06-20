FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first to cache NPM layers
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

EXPOSE 3001

# Run the backend API server by default
CMD ["npm", "start"]
