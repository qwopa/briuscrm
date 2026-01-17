# Используем легкий образ Node.js
FROM node:18-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем проект (TypeScript в JavaScript)
RUN npm run build

# Открываем порт
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]
