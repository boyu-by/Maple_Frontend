<template>
  <div class="mind-map-toolbar">
    <!-- 左侧 Logo 和标题 -->
    <div class="toolbar-left">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
        </svg>
        <span class="logo-text">思维导图</span>
      </div>
    </div>

    <!-- 中间主要工具栏 -->
    <div class="toolbar-center">
      <!-- 文件操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="handleNew" title="新建 (Ctrl+N)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>新建</span>
        </button>
        <button class="tool-btn" @click="handleOpen" title="打开 (Ctrl+O)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          <span>打开</span>
        </button>
        <button class="tool-btn" @click="handleSave" title="保存 (Ctrl+S)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4-10H7V5h9v4z"/>
          </svg>
          <span>保存</span>
        </button>
      </div>

      <!-- 编辑操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="handleUndo" :disabled="!canUndo" title="撤销 (Ctrl+Z)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
          </svg>
          <span>撤销</span>
        </button>
        <button class="tool-btn" @click="handleRedo" :disabled="!canRedo" title="重做 (Ctrl+Y)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
          </svg>
          <span>重做</span>
        </button>
      </div>

      <!-- 节点操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="handleAddChild" :disabled="!hasSelectedNode" title="添加子节点 (Enter)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>添加子节点</span>
        </button>
        <button class="tool-btn" @click="handleAddSibling" :disabled="!hasSelectedNode" title="添加同级节点 (Tab)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            <path fill="currentColor" d="M7 7l-3 3 3 3"/>
          </svg>
          <span>添加同级</span>
        </button>
        <button class="tool-btn delete-btn" @click="handleDelete" :disabled="!hasSelectedNode && !hasSelectedConnection" title="删除 (Delete)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          <span>删除</span>
        </button>
      </div>

      <!-- 视图操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="handleZoomIn" title="放大 (Ctrl++)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>放大</span>
        </button>
        <button class="tool-btn" @click="handleZoomOut" title="缩小 (Ctrl+-)">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
          </svg>
          <span>缩小</span>
        </button>
        <button class="tool-btn" @click="handleResetView" title="重置视图">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
          <span>重置</span>
        </button>
      </div>

      <!-- 布局切换 -->
      <div class="toolbar-group">
        <button class="tool-btn layout-btn" :class="{ active: layout === 'left-right' }" @click="setLayout('left-right')" title="左右布局">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
          </svg>
          <span>左右</span>
        </button>
        <button class="tool-btn layout-btn" :class="{ active: layout === 'top-bottom' }" @click="setLayout('top-bottom')" title="上下布局">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M3 3h18v4H3V3zm0 6h18v4H3V9zm0 6h18v4H3v-4zm0 6h18v4H3v-4z"/>
          </svg>
          <span>上下</span>
        </button>
      </div>
    </div>

    <!-- 右侧工具栏 -->
    <div class="toolbar-right">
      <button class="tool-btn" @click="handleExport" title="导出PNG">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
        <span>导出</span>
      </button>
      <button class="tool-btn" @click="handleClear" title="清空画布">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <span>清空</span>
      </button>
    </div>

    <!-- 文件操作对话框 -->
    <input 
      type="file" 
      ref="fileInput" 
      accept=".json" 
      style="display: none" 
      @change="handleFileOpen"
    >
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  mindMapRef: {
    type: Object,
    required: true
  },
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  },
  hasSelectedNode: {
    type: Boolean,
    default: false
  },
  hasSelectedConnection: {
    type: Boolean,
    default: false
  },
  layout: {
    type: String,
    default: 'left-right'
  }
})

const emit = defineEmits([
  'update:layout',
  'new',
  'open',
  'save',
  'undo',
  'redo',
  'add-child',
  'add-sibling',
  'delete',
  'zoom-in',
  'zoom-out',
  'reset-view',
  'export',
  'clear'
])

const fileInput = ref(null)

// 处理新建
const handleNew = () => {
  if (confirm('确定要新建吗？当前未保存的内容将丢失。')) {
    emit('new')
  }
}

// 处理打开
const handleOpen = () => {
  fileInput.value.click()
}

// 处理文件打开
const handleFileOpen = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        emit('open', data)
      } catch (error) {
        alert('文件格式错误')
      }
    }
    reader.readAsText(file)
  }
  // 清空input，允许再次选择同一个文件
  event.target.value = ''
}

// 处理保存
const handleSave = () => {
  emit('save')
}

// 处理撤销
const handleUndo = () => {
  emit('undo')
}

// 处理重做
const handleRedo = () => {
  emit('redo')
}

// 处理添加子节点
const handleAddChild = () => {
  emit('add-child')
}

// 处理添加同级节点
const handleAddSibling = () => {
  emit('add-sibling')
}

// 处理删除
const handleDelete = () => {
  emit('delete')
}

// 处理放大
const handleZoomIn = () => {
  emit('zoom-in')
}

// 处理缩小
const handleZoomOut = () => {
  emit('zoom-out')
}

// 处理重置视图
const handleResetView = () => {
  emit('reset-view')
}

// 设置布局
const setLayout = (direction) => {
  emit('update:layout', direction)
}

// 处理导出
const handleExport = () => {
  emit('export')
}

// 处理清空
const handleClear = () => {
  if (confirm('确定要清空画布吗？')) {
    emit('clear')
  }
}
</script>

<style scoped>
.mind-map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #42b883;
  font-weight: 600;
  font-size: 18px;
}

.logo-icon {
  color: #42b883;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
  justify-content: center;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid #e0e0e0;
}

.toolbar-group:last-child {
  border-right: none;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #5f5f5f;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tool-btn:hover:not(:disabled) {
  background: #f5f5f5;
  color: #42b883;
}

.tool-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn.delete-btn:hover:not(:disabled) {
  background: #fee;
  color: #f56c6c;
}

.layout-btn.active {
  background: #42b883;
  color: white;
}

.layout-btn.active:hover {
  background: #3aa876;
  color: white;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .tool-btn span {
    display: none;
  }
  
  .tool-btn {
    padding: 6px 8px;
  }
}

@media (max-width: 768px) {
  .mind-map-toolbar {
    height: auto;
    padding: 8px;
    flex-wrap: wrap;
  }
  
  .toolbar-center {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .toolbar-group {
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 4px;
  }
}
</style>