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
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @reset-view="handleResetView"
      @fit-to-screen="handleFitToScreen"
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

// 监听状态变化
function handleStateChanged(state) {
  canUndo.value = state.canUndo
  canRedo.value = state.canRedo
  hasSelectedNode.value = !!state.selectedNodeId
  hasSelectedConnection.value = !!state.selectedConnection
  layoutDirection.value = state.layout
}

// 更新缩放级别
let zoomLevelInterval
onMounted(() => {
  zoomLevelInterval = setInterval(() => {
    if (mindMapRef.value) {
      zoomLevel.value = mindMapRef.value.getScale?.() || 1
    }
  }, 100)
})

onUnmounted(() => {
  if (zoomLevelInterval) {
    clearInterval(zoomLevelInterval)
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
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
</style>
