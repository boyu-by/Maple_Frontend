# Maple Frontend

Maple思维导图前端项目，基于Vue 3 + Vite开发，提供直观的思维导图编辑功能，同时集成历史版本控制和AI智能体辅助功能。

## 技术栈

- **框架**：Vue 3
- **构建工具**：Vite
- **样式**：CSS3
- **状态管理**：Vue 3 Composition API
- **Markdown解析**：内置Markdown支持

## 功能特性

- **思维导图编辑**：支持节点的添加、删除、编辑，节点间关系的建立和调整，以及思维导图的导出为图片
- **历史版本控制**：自动保存思维导图的历史版本，支持查看、恢复和删除历史版本
- **AI智能体功能**：支持与AI进行自然语言对话，AI提供思维导图相关的建议和优化方案

## 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd Maple_Frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置后端地址**
   编辑 `vite.config.js` 文件，确保代理配置正确指向后端服务：
   ```javascript
   proxy: {
     '/api': {
       target: 'http://localhost:8080',
       changeOrigin: true,
       secure: false
     }
   }
   ```

## 运行项目

### 开发环境
```bash
npm run dev
```

项目将在 `http://localhost:5173` 启动。

### 生产环境构建
```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 项目结构

```
Maple_Frontend/
├── src/
│   ├── components/
│   │   ├── Toolbar.vue          # 工具栏组件
│   │   ├── ChatWindow.vue       # AI对话窗口组件
│   │   └── ...
│   ├── App.vue                  # 应用主组件
│   ├── main.js                  # 应用入口
│   └── ...
├── public/
├── vite.config.js               # Vite配置
├── package.json                 # 依赖配置
└── README.md                    # 项目说明
```

## 核心组件

### Toolbar.vue
- 提供思维导图编辑的核心功能按钮
- 集成版本控制按钮（创建版本、版本历史）
- 支持思维导图导出为图片

### ChatWindow.vue
- 提供与AI智能体的对话界面
- 支持Markdown格式的AI响应输出
- 实时显示AI回复

## 配置说明

### Vite配置
- `vite.config.js` 中配置了代理，将 `/api` 请求转发到后端服务
- 确保后端服务运行在 `http://localhost:8080`

## 浏览器兼容性

- 支持现代浏览器（Chrome、Firefox、Safari、Edge）
- 不支持IE浏览器

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！