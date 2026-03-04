<template>
  <div class="mind-map-container">
    <!-- 思维导图画布组件 -->
    <MindMapCanvas
      ref="mindMapCanvasRef"
      class="mind-map-canvas-wrapper"
      @node-selected="handleNodeSelected"
      @connection-selected="handleConnectionSelected"
      @layout-changed="handleLayoutChanged"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MindMapCanvas from './MindMapCanvas.vue'

// 定义事件
const emit = defineEmits(['node-selected', 'connection-selected', 'layout-changed', 'state-changed'])

// 引用思维导图画布组件实例
const mindMapCanvasRef = ref(null)

// 状态
const selectedNodeId = ref(null)
const selectedConnection = ref(null)
const layout = ref('left-right')
const canUndo = ref(false)
const canRedo = ref(false)

// 监听画布组件的状态变化
let stateInterval
onMounted(() => {
  // 初始状态检查
  if (mindMapCanvasRef.value) {
    selectedNodeId.value = mindMapCanvasRef.value.getSelectedNodeId?.() || null
    selectedConnection.value = mindMapCanvasRef.value.getSelectedConnection?.() || null
    layout.value = mindMapCanvasRef.value.getLayoutDirection?.() || 'left-right'
    canUndo.value = (mindMapCanvasRef.value.getUndoStack?.()?.length || 0) > 0
    canRedo.value = (mindMapCanvasRef.value.getRedoStack?.()?.length || 0) > 0
    
    // 触发初始状态变化事件
    emit('state-changed', {
      selectedNodeId: selectedNodeId.value,
      selectedConnection: selectedConnection.value,
      layout: layout.value,
      canUndo: canUndo.value,
      canRedo: canRedo.value
    })
  }
  
  // 降低轮询频率，从 100ms 改为 500ms
  stateInterval = setInterval(() => {
    if (mindMapCanvasRef.value) {
      const newSelectedNodeId = mindMapCanvasRef.value.getSelectedNodeId?.() || null
      const newSelectedConnection = mindMapCanvasRef.value.getSelectedConnection?.() || null
      const newLayout = mindMapCanvasRef.value.getLayoutDirection?.() || 'left-right'
      const newCanUndo = (mindMapCanvasRef.value.getUndoStack?.()?.length || 0) > 0
      const newCanRedo = (mindMapCanvasRef.value.getRedoStack?.()?.length || 0) > 0
      
      // 只在状态变化时触发事件
      if (newSelectedNodeId !== selectedNodeId.value ||
          newSelectedConnection !== selectedConnection.value ||
          newLayout !== layout.value ||
          newCanUndo !== canUndo.value ||
          newCanRedo !== canRedo.value) {
        selectedNodeId.value = newSelectedNodeId
        selectedConnection.value = newSelectedConnection
        layout.value = newLayout
        canUndo.value = newCanUndo
        canRedo.value = newCanRedo
        
        emit('state-changed', {
          selectedNodeId: selectedNodeId.value,
          selectedConnection: selectedConnection.value,
          layout: layout.value,
          canUndo: canUndo.value,
          canRedo: canRedo.value
        })
      }
    }
  }, 500)
})

onUnmounted(() => {
  clearInterval(stateInterval)
})

// 监听画布事件
function handleNodeSelected(nodeId) {
  emit('node-selected', nodeId)
}

function handleConnectionSelected(connection) {
  emit('connection-selected', connection)
}

function handleLayoutChanged(direction) {
  emit('layout-changed', direction)
}

// 暴露给父组件的 API 接口
defineExpose({
  // 委托给 MindMapCanvas 的方法
  getMindMapData: () => mindMapCanvasRef.value?.getMindMapData?.(),
  loadMindMapData: (data) => mindMapCanvasRef.value?.loadMindMapData?.(data),
  exportAsPNG: () => mindMapCanvasRef.value?.exportAsPNG?.(),
  clearCanvas: () => mindMapCanvasRef.value?.clearCanvas?.(),
  getLayoutDirection: () => mindMapCanvasRef.value?.getLayoutDirection?.(),
  setLayoutDirection: (direction) => mindMapCanvasRef.value?.setLayoutDirection?.(direction),
  
  // 新增方法
  undo: () => mindMapCanvasRef.value?.undo?.(),
  redo: () => mindMapCanvasRef.value?.redo?.(),
  addChildNode: (parentId) => mindMapCanvasRef.value?.addChildNode?.(parentId),
  addSiblingNode: () => {
    mindMapCanvasRef.value?.addSiblingNode?.()
  },
  deleteSelected: () => {
    const selectedId = mindMapCanvasRef.value?.getSelectedNodeId?.()
    if (selectedId) {
      mindMapCanvasRef.value?.deleteNode?.(selectedId)
    }
  },
  zoomIn: () => {
    mindMapCanvasRef.value?.zoomIn?.()
  },
  zoomOut: () => {
    mindMapCanvasRef.value?.zoomOut?.()
  },
  resetView: () => {
    // 重置视图到初始状态
    mindMapCanvasRef.value?.resetView?.()
  },
  fitToScreen: () => {
    // 适应屏幕（真正适应所有节点）
    mindMapCanvasRef.value?.fitToScreen?.()
  },
  centerView: () => {
    // 居中视图
    mindMapCanvasRef.value?.centerView?.()
  },
  
  // 状态访问方法
  getSelectedNodeId: () => selectedNodeId.value,
  getSelectedConnection: () => selectedConnection.value,
  getUndoStack: () => mindMapCanvasRef.value?.getUndoStack?.() || [],
  getRedoStack: () => mindMapCanvasRef.value?.getRedoStack?.() || [],
  getScale: () => mindMapCanvasRef.value?.getScale?.() || 1
})
</script>

<style scoped>
.mind-map-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.mind-map-canvas-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
