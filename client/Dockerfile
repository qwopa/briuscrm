# Этап сборки (Build stage)
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Этап запуска (Production stage)
FROM nginx:alpine
# Копируем собранные файлы React в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
