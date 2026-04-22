# Stage 1: Build
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source files including patches
COPY . .

# Manually apply the patch (since npm install might not run it automatically)
RUN apt-get update && apt-get install -y patch && \
    patch -p1 -d node_modules/@material/material-color-utilities < patches/@material__material-color-utilities.patch

# Build the application
RUN npm run build

# Stage 2: Run
FROM node:24-slim

WORKDIR /app

# Copy built application and server script
COPY --from=builder /app/.generated ./.generated
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Expose the default port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
