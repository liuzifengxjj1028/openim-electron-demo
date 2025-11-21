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

# 复制 Nginx 配置模板和启动脚本
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

# 设置脚本可执行权限
RUN chmod +x /docker-entrypoint.sh

# Railway 使用的端口
ENV PORT=80

EXPOSE $PORT

# 使用启动脚本
CMD ["/docker-entrypoint.sh"]
