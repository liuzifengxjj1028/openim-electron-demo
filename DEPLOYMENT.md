# Railway 部署指南

本项目是一个基于 React + Vite 的 Web 应用，可以直接部署到 Railway 作为在线服务。

## 前置准备

1. 注册 Railway 账号: https://railway.app
2. 安装 Railway CLI (可选):
   ```bash
   npm install -g @railway/cli
   ```

## 部署方式 1: 通过 GitHub 自动部署 (推荐)

### 步骤 1: 推送代码到 GitHub

```bash
# 初始化 git 仓库 (如果还没有)
git init
git add .
git commit -m "准备部署到 Railway"

# 推送到 GitHub
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 步骤 2: 在 Railway 创建项目

1. 登录 Railway: https://railway.app
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的 GitHub 仓库
5. Railway 会自动检测 `Dockerfile` 并开始构建

### 步骤 3: 配置环境变量 (如果需要)

在 Railway 项目设置中添加环境变量:
- `VITE_CHAT_URL`: 你的后端 API 地址
- 其他在 `.env` 文件中的变量

### 步骤 4: 生成公网域名

1. 在 Railway 项目中点击 "Settings"
2. 找到 "Domains" 部分
3. 点击 "Generate Domain"
4. Railway 会自动分配一个 `.railway.app` 域名

## 部署方式 2: 使用 Railway CLI

```bash
# 登录 Railway
railway login

# 初始化项目
railway init

# 部署
railway up

# 生成域名
railway domain
```

## 部署方式 3: Docker 本地测试

在部署到 Railway 之前，可以先在本地测试 Docker 构建:

```bash
# 构建镜像
docker build -t openim-web .

# 运行容器
docker run -p 8080:80 openim-web

# 访问 http://localhost:8080 测试
```

## 项目结构说明

### 新增文件

部署所需的配置文件已经准备好:

- `Dockerfile` - Docker 构建配置
- `nginx.conf` - Nginx 服务器配置
- `.dockerignore` - 优化 Docker 构建
- `railway.toml` - Railway 平台配置

### 构建流程

1. **阶段 1 (Builder)**:
   - 使用 Node.js 18 Alpine 镜像
   - 安装依赖 (`npm install`)
   - 设置 `BROWSER_MODE=true` 环境变量
   - 执行 `npm run build` 构建生产版本
   - 生成的静态文件在 `dist/` 目录

2. **阶段 2 (Production)**:
   - 使用 Nginx Alpine 镜像
   - 复制构建产物到 Nginx 服务目录
   - 配置 SPA 路由支持
   - 启用 Gzip 压缩
   - 暴露 80 端口

## 环境变量配置

在 Railway 中需要配置的环境变量 (根据实际情况):

```
VITE_CHAT_URL=<your-backend-api-url>
VITE_IM_API_URL=<your-im-api-url>
# 其他环境变量...
```

## 常见问题

### 1. 构建失败 - 内存不足

Railway 免费计划有内存限制。解决方法:
- 升级到 Railway Pro 计划
- 或优化 `package.json` 依赖

### 2. 路由 404 错误

确保 `nginx.conf` 中有正确的 SPA 路由配置:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 3. WebAssembly 文件加载失败

确保 `nginx.conf` 中配置了正确的 MIME 类型:
```nginx
location ~* \.wasm$ {
    types {
        application/wasm wasm;
    }
}
```

### 4. API 请求跨域问题

如果后端 API 和前端不在同一域名:
- 确保后端配置了 CORS
- 或在 `nginx.conf` 中配置反向代理

## 性能优化

项目已包含以下优化:

1. **Gzip 压缩** - 减少传输大小
2. **静态资源缓存** - 1 年缓存期
3. **代码分割** - Vite 自动处理
4. **多阶段构建** - 减小最终镜像大小

## 监控和日志

在 Railway 中可以查看:
- 部署日志
- 应用日志
- 性能指标
- 使用情况

## 成本估算

Railway 定价 (截至 2024):
- Hobby Plan: $5/月 (包含 $5 免费额度)
- 超出部分按使用量计费

估算费用:
- 静态网站托管: 约 $0-5/月
- 流量费用: 根据访问量而定

## 更新部署

### 通过 GitHub (自动部署)

```bash
git add .
git commit -m "更新功能"
git push
```

Railway 会自动检测并重新部署。

### 通过 Railway CLI

```bash
railway up
```

## 回滚版本

在 Railway 控制台:
1. 进入项目
2. 点击 "Deployments"
3. 选择历史版本
4. 点击 "Redeploy"

## 自定义域名

1. 在 Railway 项目设置中添加自定义域名
2. 在域名提供商处添加 CNAME 记录:
   ```
   your-domain.com -> <your-railway-url>.railway.app
   ```

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite 4
- **UI 库**: Ant Design 5
- **状态管理**: Zustand
- **IM SDK**: OpenIM WASM SDK
- **Web 服务器**: Nginx (Alpine)
- **容器**: Docker

## 支持

如有问题，请查看:
- Railway 文档: https://docs.railway.app
- OpenIM 文档: https://docs.openim.io
- 项目 Issues

## License

请查看项目的 LICENSE 文件
