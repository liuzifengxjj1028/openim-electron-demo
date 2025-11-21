# 使用 Node.js 构建
FROM node:18-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++ cmake

# 复制依赖文件
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 设置浏览器模式并构建
ENV BROWSER_MODE=true
RUN npm run build

# 使用 Nginx 服务静态文件
FROM nginx:alpine

# 复制构建产物到 Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
