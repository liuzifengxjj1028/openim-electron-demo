# OpenIM Electron Demo - 开发流程规范

## 📂 环境说明

### 本地开发环境
- **前端项目路径**: `/Users/budlaw/openim-electron-demo`
- **后端项目路径**: `/Users/budlaw/openim-chat-source`
- **本地开发端口**: http://localhost:5173

### 生产环境
- **服务器地址**: `206.189.81.194`
- **后端 API**: http://206.189.81.194:10008 (chat-api)
- **管理 API**: http://206.189.81.194:10009 (admin-api)

## 🔄 标准开发流程

### 1️⃣ 本地开发
所有功能开发和 bug 修复**必须**在本地环境进行：

```bash
# 启动前端开发服务器
cd ~/openim-electron-demo
npm run dev
```

### 2️⃣ 本地测试
- 在本地环境充分测试所有功能
- 确认功能正常运行，无 bug
- 验证用户体验和性能
- **只有测试通过后才能进入下一步**

### 3️⃣ 代码提交
测试通过后，提交代码到 git：

```bash
# 查看修改的文件
git status

# 添加修改的文件
git add <files>

# 提交代码（使用规范的 commit message）
git commit -m "feat: 添加功能描述"

# 推送到远程仓库
git push
```

### 4️⃣ 生产环境部署
**仅在用户确认测试通过后**进行部署：

1. 前端：从 GitHub 拉取最新代码
2. 后端：构建 Docker 镜像并重启容器

## ⚠️ 严格禁止的操作

❌ **禁止直接在生产环境修改代码**
❌ **禁止跳过本地测试直接部署**
❌ **禁止未经用户测试确认就推送到生产**
❌ **禁止在生产环境进行实验性修改**

## ✅ 开发原则

1. **先本地，后生产** - 所有修改都在本地完成
2. **先测试，后部署** - 充分测试后再部署
3. **先确认，后推送** - 用户确认后才部署生产
4. **先备份，后更新** - 重要更新前先备份

## 📝 Commit Message 规范

使用语义化的 commit message：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建/工具链相关

示例：
```
feat: 添加实时时区显示功能
fix: 修复时区更新不及时的问题
docs: 更新开发流程文档
```

## 🛠️ 常用命令

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

### Git 操作
```bash
# 查看状态
git status

# 查看修改
git diff

# 查看提交历史
git log --oneline -10

# 创建新分支
git checkout -b feature/new-feature

# 切换分支
git checkout main
```

## 📞 联系方式

如有问题，请及时沟通确认后再进行操作。

---

**最后更新**: 2025-11-24
**版本**: v1.0
