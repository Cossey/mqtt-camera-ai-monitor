FROM node:22

# Install ffmpeg for camera service
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy TypeScript configuration
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Copy config directory (but config.yaml should be mounted as volume)
COPY config/ ./config/

# Build the TypeScript code
RUN npm run build

# Expose the necessary port (if applicable)
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/app.js"]