# Use official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory to /app
WORKDIR /app

# Copy the requirements file into the container at /app/backend
COPY backend/requirements.txt /app/backend/

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the current directory contents into the container at /app
COPY . /app

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Change working directory to backend to run app
WORKDIR /app/backend

# Define environment variables
ENV PORT=8080
ENV DATABASE_PATH=/data/tasks.db

# Run app.py when the container launches using gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]
