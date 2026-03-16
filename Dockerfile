FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg libgl1-mesa-glx libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages opencv-python-headless numpy

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install
COPY src/ src/
RUN npx tsc
RUN npm prune --production

COPY public/ public/
COPY scripts/ scripts/
RUN mkdir -p /tmp/jobs

EXPOSE 6232
CMD ["node", "dist/index.js"]
