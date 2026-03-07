<template>
  <div id="app">
    <!-- 工具栏 -->
    <Toolbar
      ref="toolbarRef"
      :canUndo="canUndo"
      :canRedo="canRedo"
      :hasSelectedNode="hasSelectedNode"
      :hasSelectedConnection="hasSelectedConnection"
      :layout="layoutDirection"
      @new="handleNew"
      @open="handleOpen"
      @save="handleSave"
      @undo="handleUndo"
      @redo="handleRedo"
      @add-child="handleAddChild"
      @add-sibling="handleAddSibling"
      @delete="handleDelete"
      @export="handleExport"
      @clear="handleClear"
      @set-layout="handleSetLayout"
      @file-loaded="handleFileLoaded"
    />

    <!-- 右侧缩放工具栏 -->
    <ZoomToolbar
      :zoomLevel="zoomLevel"
      :minZoom="0.1"
      :maxZoom="5.0"
      :isCreateNodeMode="isCreateNodeMode"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @reset-view="handleResetView"
      @fit-to-screen="handleFitToScreen"
      @toggle-create-node-mode="handleToggleCreateNodeMode"
      @create-version="handleCreateVersion"
      @show-versions="handleShowVersions"
    />
    
    <!-- 画布容器 -->
    <MindMapContainer 
      ref="mindMapRef"
      @node-selected="handleNodeSelected"
      @connection-selected="handleConnectionSelected"
      @layout-changed="handleLayoutChanged"
      @state-changed="handleStateChanged"
    />

    <!-- AI 聊天窗口 -->
    <ChatWindow ref="chatWindowRef" />

    <!-- 版本历史对话框 -->
    <div v-if="showVersionDialog" class="version-dialog-overlay" @click="showVersionDialog = false">
      <div class="version-dialog" @click.stop>
        <div class="version-dialog-header">
          <h3>版本历史</h3>
          <button class="close-btn" @click="showVersionDialog = false">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="version-dialog-content">
          <div v-if="isLoadingVersions" class="loading">加载版本历史中...</div>
          <div v-else-if="versions.length === 0" class="empty">暂无版本历史</div>
          <div v-else class="version-list">
            <div 
              v-for="version in versions" 
              :key="version.version"
              class="version-item"
            >
              <div class="version-info">
                <div class="version-number">版本 {{ version.version }}</div>
                <div class="version-time">{{ formatDate(version.createdAt) }}</div>
              </div>
              <div class="version-actions">
                <button class="restore-btn" @click="handleRestoreVersion(version.version)">
                  恢复
                </button>
                <button class="delete-btn" @click="handleDeleteVersion(version.version)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MindMapContainer from './components/MindMapContainer.vue'
import Toolbar from './components/Toolbar.vue'
import ZoomToolbar from './components/ZoomToolbar.vue'
import ChatWindow from './components/ChatWindow.vue'

const mindMapRef = ref(null)
const toolbarRef = ref(null)
const chatWindowRef = ref(null)
const canUndo = ref(false)
const canRedo = ref(false)
const hasSelectedNode = ref(false)
const hasSelectedConnection = ref(false)
const layoutDirection = ref('left-right')
const zoomLevel = ref(1)
const isCreateNodeMode = ref(false)

// 版本控制相关状态
const showVersionDialog = ref(false)
const isLoadingVersions = ref(false)
const versions = ref([])
const currentMindMapId = ref(1) // 暂时使用固定ID，实际应用中应该从后端获取

// 监听状态变化
function handleStateChanged(state) {
  canUndo.value = state.canUndo
  canRedo.value = state.canRedo
  hasSelectedNode.value = !!state.selectedNodeId
  hasSelectedConnection.value = !!state.selectedConnection
  layoutDirection.value = state.layout
}

// 更新缩放级别和创建节点模式
let zoomLevelInterval
let createNodeModeInterval
onMounted(() => {
  zoomLevelInterval = setInterval(() => {
    if (mindMapRef.value) {
      zoomLevel.value = mindMapRef.value.getScale?.() || 1
    }
  }, 100)
  
  createNodeModeInterval = setInterval(() => {
    if (mindMapRef.value) {
      isCreateNodeMode.value = mindMapRef.value.getCreateNodeMode?.() || false
    }
  }, 100)
})

onUnmounted(() => {
  if (zoomLevelInterval) {
    clearInterval(zoomLevelInterval)
  }
  if (createNodeModeInterval) {
    clearInterval(createNodeModeInterval)
  }
})

// 新建
function handleNew() {
  if (confirm('确定要新建吗？当前未保存的内容将丢失。')) {
    mindMapRef.value?.clearCanvas()
    // 初始化示例数据
    mindMapRef.value?.loadMindMapData({
      nodes: {
        '1': { id: '1', text: '根节点', x: 400, y: 300, width: 100, height: 40, parentId: null, children: ['2', '3'], collapsed: false },
        '2': { id: '2', text: '子节点1', x: 550, y: 250, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
        '3': { id: '3', text: '子节点2', x: 550, y: 350, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
      },
      rootIds: ['1']
    })
  }
}

// 打开
function handleOpen() {
  toolbarRef.value?.triggerFileOpen()
}

// 处理文件加载完成
function handleFileLoaded(payload) {
  const data = payload.data
  if (data) {
    mindMapRef.value?.loadMindMapData(data)
  }
}

// 保存
function handleSave() {
  const data = mindMapRef.value?.getMindMapData()
  if (data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mindmap-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

// 撤销/重做
function handleUndo() {
  mindMapRef.value?.undo()
}

function handleRedo() {
  mindMapRef.value?.redo()
}

// 添加子节点
function handleAddChild() {
  const selectedId = mindMapRef.value?.getSelectedNodeId?.()
  if (selectedId) {
    mindMapRef.value?.addChildNode(selectedId)
  }
}

// 添加同级节点
function handleAddSibling() {
  mindMapRef.value?.addSiblingNode()
}

// 删除
function handleDelete() {
  mindMapRef.value?.deleteSelected()
}

// 缩放
function handleZoomIn() {
  mindMapRef.value?.zoomIn()
}

function handleZoomOut() {
  mindMapRef.value?.zoomOut()
}

function handleResetView() {
  mindMapRef.value?.resetView()
}

function handleFitToScreen() {
  mindMapRef.value?.fitToScreen()
}

// 设置布局
function handleSetLayout(direction) {
  mindMapRef.value?.setLayoutDirection(direction)
}

// 切换创建节点模式
function handleToggleCreateNodeMode() {
  mindMapRef.value?.toggleCreateNodeMode()
}

// 导出
function handleExport() {
  const pngDataUrl = mindMapRef.value?.exportAsPNG()
  if (pngDataUrl) {
    const link = document.createElement('a')
    link.href = pngDataUrl
    link.download = 'mindmap.png'
    link.click()
  }
}

// 清空
function handleClear() {
  if (confirm('确定要清空画布吗？')) {
    mindMapRef.value?.clearCanvas()
  }
}

// 监听画布事件
function handleNodeSelected(nodeId) {
  hasSelectedNode.value = !!nodeId
}

function handleConnectionSelected(connection) {
  hasSelectedConnection.value = !!connection
}

function handleLayoutChanged(direction) {
  layoutDirection.value = direction
}

// 版本控制相关方法
async function handleCreateVersion() {
  try {
    const mindMapData = mindMapRef.value?.getMindMapData()
    if (!mindMapData) return

    const response = await fetch(`/api/mind-maps/${currentMindMapId.value}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mindMapData),
    })

    if (response.ok) {
      alert('版本创建成功！')
    } else {
      const error = await response.json()
      alert(`版本创建失败：${error}`)
    }
  } catch (error) {
    console.error('创建版本失败:', error)
    alert('版本创建失败，请稍后再试')
  }
}

async function handleShowVersions() {
  try {
    isLoadingVersions.value = true
    const response = await fetch(`/api/mind-maps/${currentMindMapId.value}/versions`)
    
    if (response.ok) {
      versions.value = await response.json()
    } else {
      const error = await response.json()
      console.error('获取版本历史失败:', error)
      versions.value = []
    }
  } catch (error) {
    console.error('获取版本历史失败:', error)
    versions.value = []
  } finally {
    isLoadingVersions.value = false
    showVersionDialog.value = true
  }
}

async function handleRestoreVersion(versionNumber) {
  try {
    const response = await fetch(`/api/mind-maps/${currentMindMapId.value}/versions/${versionNumber}/restore`, {
      method: 'POST',
    })

    if (response.ok) {
      const versionData = await response.json()
      if (versionData.mapData) {
        mindMapRef.value?.loadMindMapData(versionData.mapData)
        showVersionDialog.value = false
        alert('版本恢复成功！')
      }
    } else {
      const error = await response.json()
      alert(`版本恢复失败：${error}`)
    }
  } catch (error) {
    console.error('恢复版本失败:', error)
    alert('版本恢复失败，请稍后再试')
  }
}

async function handleDeleteVersion(versionNumber) {
  // 先显示确认弹窗
  if (!confirm('确定要删除这个版本吗？')) return
  
  try {
    const response = await fetch(`/api/mind-maps/${currentMindMapId.value}/versions/${versionNumber}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      alert('版本删除成功！')
      // 重新加载版本列表
      await handleShowVersions()
    } else {
      const error = await response.json()
      alert(`版本删除失败：${error}`)
    }
  } catch (error) {
    console.error('删除版本失败:', error)
    alert('版本删除失败，请稍后再试')
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f5f5f5;
}

/* 版本历史对话框样式 */
.version-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.version-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.version-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.version-dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.version-dialog-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.loading, .empty {
  text-align: center;
  padding: 40px 0;
  color: #64748b;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.version-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.version-info {
  flex: 1;
}

.version-number {
  font-weight: 600;
  font-size: 16px;
  color: #1e293b;
  margin-bottom: 4px;
}

.version-time {
  font-size: 14px;
  color: #64748b;
}

.restore-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.restore-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.restore-btn:active {
  transform: translateY(0);
}

.delete-btn {
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-left: 8px;
}

.delete-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.delete-btn:active {
  transform: translateY(0);
}
</style>
