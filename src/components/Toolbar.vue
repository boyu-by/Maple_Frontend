<template>
  <div class="toolbar">
    <!-- 左侧 Logo 和标题 -->
    <div class="toolbar-left">
      <div class="logo">
        <span class="logo-icon">🍁</span>
        <span class="logo-text">Maple</span>
      </div>
    </div>

    <!-- 中间主要工具栏 -->
    <div class="toolbar-center">
      <!-- 文件操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="$emit('new')" title="新建 (Ctrl+N)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>新建</span>
        </button>
        <button class="tool-btn" @click="$emit('open')" title="打开 (Ctrl+O)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          <span>打开</span>
        </button>
        <button class="tool-btn" @click="$emit('save')" title="保存 (Ctrl+S)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>保存</span>
        </button>
      </div>

      <!-- 编辑操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="$emit('undo')" :disabled="!canUndo" title="撤销 (Ctrl+Z)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 14L4 9l5-5"/>
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
          </svg>
          <span>撤销</span>
        </button>
        <button class="tool-btn" @click="$emit('redo')" :disabled="!canRedo" title="重做 (Ctrl+Y)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 14l5-5-5-5"/>
            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>
          </svg>
          <span>重做</span>
        </button>
      </div>

      <!-- 节点操作 -->
      <div class="toolbar-group">
        <button class="tool-btn" @click="$emit('add-child')" :disabled="!hasSelectedNode" title="添加子节点 (Enter)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>添加子节点</span>
        </button>
        <button class="tool-btn" @click="$emit('add-sibling')" :disabled="!hasSelectedNode" title="添加同级节点 (Tab)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>添加同级</span>
        </button>
        <button class="tool-btn delete-btn" @click="$emit('delete')" :disabled="!hasSelectedNode && !hasSelectedConnection" title="删除 (Delete)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>删除</span>
        </button>
      </div>

      <!-- 布局切换 -->
      <div class="toolbar-group">
        <button class="tool-btn layout-btn" :class="{ active: layout === 'left-right' }" @click="$emit('set-layout', 'left-right')" title="左右布局">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="8" height="8"/>
            <rect x="13" y="3" width="8" height="8"/>
            <rect x="3" y="13" width="8" height="8"/>
            <rect x="13" y="13" width="8" height="8"/>
          </svg>
          <span>左右</span>
        </button>
        <button class="tool-btn layout-btn" :class="{ active: layout === 'top-bottom' }" @click="$emit('set-layout', 'top-bottom')" title="上下布局">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="4"/>
            <rect x="3" y="9" width="18" height="4"/>
            <rect x="3" y="15" width="18" height="4"/>
          </svg>
          <span>上下</span>
        </button>
      </div>
    </div>

    <!-- 右侧工具栏 -->
    <div class="toolbar-right">
      <button class="tool-btn" @click="$emit('export')" title="导出PNG">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span>导出为图片</span>
      </button>
      <button class="tool-btn" @click="$emit('clear')" title="清空画布">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>清空</span>
      </button>
    </div>

    <!-- 隐藏的文件输入框 -->
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
import { ref } from 'vue'

// 定义 props
defineProps({
  canUndo: Boolean,
  canRedo: Boolean,
  hasSelectedNode: Boolean,
  hasSelectedConnection: Boolean,
  layout: {
    type: String,
    default: 'left-right'
  }
})

// 定义事件
const emit = defineEmits([
  'new', 'open', 'save',
  'undo', 'redo',
  'add-child', 'add-sibling', 'delete',
  'set-layout',
  'export', 'clear',
  'file-open', 'file-loaded'
])

const fileInput = ref(null)

// 暴露给父组件的方法
defineExpose({
  triggerFileOpen: () => {
    fileInput.value.click()
  }
})

// 处理文件打开
function handleFileOpen(event) {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        // 通过 Vue emit 传递数据
        emit('file-loaded', { data })
      } catch (error) {
        alert('文件格式错误')
      }
    }
    reader.readAsText(file)
  }
  event.target.value = ''
}

</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  height: 52px;
  width: 100%;
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  box-shadow: 0 4px 20px rgba(230, 57, 70, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  position: relative;
  z-index: 100;
}

.toolbar::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
}

.toolbar-left {
  display: flex;
  align-items: center;
  min-width: 140px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.02);
}

.logo-icon {
  font-size: 24px;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  min-width: 0;
  padding: 0 8px;
  overflow-x: auto;
}

.toolbar-center::-webkit-scrollbar {
  height: 4px;
}

.toolbar-center::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.toolbar-center::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.toolbar-center::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.toolbar-group:last-child {
  border-right: none;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 140px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  min-width: 60px;
}

.tool-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.tool-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.tool-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
}

.tool-btn.delete-btn:hover:not(:disabled) {
  background: rgba(139, 69, 19, 0.4);
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.3);
}

.layout-btn.active {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 140, 66, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.layout-btn.active:hover {
  background: rgba(255, 255, 255, 0.4);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 140, 66, 0.5);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .tool-btn span {
    display: none;
  }

  .tool-btn {
    padding: 5px 6px;
    min-width: 32px;
  }

  .toolbar-left,
  .toolbar-right {
    min-width: 120px;
  }

  .toolbar-group {
    padding: 0 4px;
    gap: 3px;
  }
}

@media (max-width: 768px) {
  .toolbar {
    height: auto;
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar-left,
  .toolbar-right {
    min-width: auto;
    flex: 1;
  }

  .toolbar-left {
    justify-content: flex-start;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .toolbar-center {
    order: 2;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
    width: 100%;
  }

  .toolbar-group {
    border-right: none;
    padding: 0 3px;
    gap: 3px;
  }

  .tool-btn {
    padding: 5px 6px;
    min-width: 32px;
  }
}

@media (max-width: 480px) {
  .toolbar {
    padding: 6px 10px;
    gap: 6px;
  }

  .toolbar-left {
    flex: 1;
  }

  .logo-text {
    font-size: 18px;
  }

  .toolbar-center {
    display: none;
  }

  .toolbar-right {
    flex: 0 0 auto;
  }
}
</style>
