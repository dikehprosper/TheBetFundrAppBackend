

# Use an intermediate build stage to install dependencies
FROM node:20 
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Use a smaller base image for the final stage
FROM node:20-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .


# Expose the port the application runs on
EXPOSE 5001

# Command to run the application
CMD ["npm", "start"]




