# Use the official Node.js 20 image from the Docker Hub
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the application runs on
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]



