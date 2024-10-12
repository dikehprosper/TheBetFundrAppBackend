# Use a Node.js base image that includes npm
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the dependencies including npm
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the application runs on (adjust as necessary)
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]
