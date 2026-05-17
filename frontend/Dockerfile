FROM node:18-alpine AS builder
WORKDIR /app
ARG VITE_APP_VERSION
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
# expose build-time version inside the built artifacts for runtime inspection
RUN echo "${VITE_APP_VERSION:-v0.0.0}" > /app/dist/VITE_APP_VERSION.txt

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
