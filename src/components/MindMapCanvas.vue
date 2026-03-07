<template>
  <div
    class="mind-map-canvas"
    ref="containerRef"
    tabindex="0"
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
    @dblclick="onDblClick"
    @contextmenu.prevent="onContextMenu"
  >
    <canvas ref="canvasRef"></canvas>

    <!--浮动输入框（双击调用）-->
    <div
      v-if="editingNodeId"
      class="node-editor"
      :style="{ left: editorPosition.x + 'px', top: editorPosition.y + 'px' }"
    >
      <input
        ref="inputRef"
        v-model="editingText"
        @blur="finishEdit"
        @keyup.enter="finishEdit"
        type="text"
        autofocus
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'

// ==================== 变换矩阵类（成熟的设计模式）====================
class TransformMatrix {
  constructor() {
    this.reset()
  }

  reset() {
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
  }

  // 应用变换到Canvas上下文
  apply(ctx, width, height, dpr = 1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate((width / 2 + this.offsetX) * dpr, (height / 2 + this.offsetY) * dpr)
    ctx.scale(this.scale * dpr, this.scale * dpr)
  }

  // 屏幕坐标转世界坐标
  screenToWorld(screenX, screenY, width, height) {
    const dpr = window.devicePixelRatio || 1
    return {
      x: (screenX / dpr - width / 2 - this.offsetX) / this.scale,
      y: (screenY / dpr - height / 2 - this.offsetY) / this.scale
    }
  }

  // 世界坐标转屏幕坐标
  worldToScreen(worldX, worldY, width, height) {
    const dpr = window.devicePixelRatio || 1
    return {
      x: (worldX * this.scale + width / 2 + this.offsetX) * dpr,
      y: (worldY * this.scale + height / 2 + this.offsetY) * dpr
    }
  }

  // 以指定点为中心缩放
  zoomToPoint(newScale, screenX, screenY, width, height) {
    const worldPoint = this.screenToWorld(screenX, screenY, width, height)
    this.scale = newScale
    const newScreenPoint = this.worldToScreen(worldPoint.x, worldPoint.y, width, height)
    this.offsetX += screenX - newScreenPoint.x
    this.offsetY += screenY - newScreenPoint.y
  }
}

// ==================== 组件状态 ====================
const canvasRef = ref(null)
const containerRef = ref(null)
const inputRef = ref(null)
const ctx = ref(null)
let animationFrameId = null
let nodeIdCounter = 0

// 撤销/重做功能
const undoStack = ref([])
const redoStack = ref([])
const MAX_HISTORY = 50

// 高亮动画状态
const highlightAnimation = ref({
  active: false,
  progress: 0,
  targetNodeId: null
})
let highlightAnimationFrameId = null

// 节点动画状态
const nodeAnimations = ref(new Map()) // nodeId -> { type: 'create'|'delete'|'move', progress: 0, fromX, fromY, toX, toY }
let nodeAnimationFrameId = null

// 定义事件
const emit = defineEmits(['node-selected', 'connection-selected', 'layout-changed', 'state-changed'])

// 变换矩阵（成熟的视图控制）
const transform = new TransformMatrix()

// 节点储存（世界坐标系，中心为0,0）
const nodes = ref({})
const rootIds = ref([])

// 交互状态
const isPanning = ref(false)
const isDraggingNode = ref(false)
const dragNodeId = ref(null)
const dragOffsetX = ref(0)
const dragOffsetY = ref(0)
const dragNodeIds = ref([])
const dragNodePositions = ref({})
const hasNodeMoved = ref(false)
const isRightClickDrag = ref(false)

const panStartX = ref(0)
const panStartY = ref(0)

// 自动平移相关状态
const isAutoPanning = ref(false)
let autoPanAnimationFrameId = null
const edgeThreshold = 50 // 边缘触发阈值（像素）
const autoPanSpeed = 15 // 自动平移速度（像素/帧）

const selectedNodeId = ref(null)
const selectedConnection = ref(null)

const editingNodeId = ref(null)
const editingText = ref('')
const editorPosition = reactive({ x: 0, y: 0 })

// 创建节点模式
const isCreateNodeMode = ref(false)

const isSpacePressed = ref(false)
const layoutDirection = ref('left-right')
const hoveredNodeId = ref(null)

// ==================== 生命周期钩子 ====================
onMounted(() => {
  ctx.value = canvasRef.value.getContext('2d')
  setupCanvas()
  initDemoData()
  draw()

  // 添加事件监听
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  
  // 停止高亮动画
  stopHighlightAnimation()
  
  // 停止自动平移
  stopAutoPan()
  
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', handleResize)
})

// ==================== Canvas设置（成熟的DPI处理）====================
function setupCanvas() {
  const rect = containerRef.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  // 设置Canvas的实际像素尺寸
  canvasRef.value.width = rect.width * dpr
  canvasRef.value.height = rect.height * dpr
  
  // 设置CSS显示尺寸
  canvasRef.value.style.width = rect.width + 'px'
  canvasRef.value.style.height = rect.height + 'px'
  
  // 设置抗锯齿
  ctx.value = canvasRef.value.getContext('2d', {
    alpha: false,
    antialias: true
  })
}

function getContainerSize() {
  const rect = containerRef.value.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

// ==================== 窗口大小变化处理 ====================
function handleResize() {
  setupCanvas()
  scheduleDraw()
}

// ==================== 撤销/重做功能 ====================
function emitStateChanged() {
  // 获取当前布局方向
  const currentLayout = getLayoutDirection()
  
  emit('state-changed', {
    selectedNodeId: selectedNodeId.value,
    selectedConnection: selectedConnection.value,
    layout: currentLayout,
    canUndo: undoStack.value.length > 0,
    canRedo: redoStack.value.length > 0
  })
}

function saveState() {
  const state = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  undoStack.value.push(state)
  redoStack.value = []
  if (undoStack.value.length > MAX_HISTORY) {
    undoStack.value.shift()
  }
  // 触发状态变化事件
  emitStateChanged()
}

function undo() {
  if (undoStack.value.length === 0) return

  const currentState = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  redoStack.value.push(currentState)

  const previousState = undoStack.value.pop()
  nodes.value = previousState.nodes
  rootIds.value = previousState.rootIds
  nodeIdCounter = previousState.nodeIdCounter

  selectedNodeId.value = null
  stopHighlightAnimation()
  scheduleDraw()
  // 触发状态变化事件以更新UI
  emitStateChanged()
}

function redo() {
  if (redoStack.value.length === 0) return

  const currentState = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  undoStack.value.push(currentState)

  const nextState = redoStack.value.pop()
  nodes.value = nextState.nodes
  rootIds.value = nextState.rootIds
  nodeIdCounter = nextState.nodeIdCounter

  selectedNodeId.value = null
  stopHighlightAnimation()
  scheduleDraw()
  // 触发状态变化事件以更新UI
  emitStateChanged()
}

// ==================== 示例数据初始化 ====================
function initDemoData() {
  transform.reset()
  
  // 世界坐标系，中心为0,0
  nodes.value = {
    '1': { id: '1', text: '根节点', x: -50, y: -20, width: 100, height: 40, parentId: null, children: ['2', '3'], collapsed: false, layoutDirection: 'left-right' },
    '2': { id: '2', text: '子节点1', x: 100, y: -70, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
    '3': { id: '3', text: '子节点2', x: 100, y: 30, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
  }
  rootIds.value = ['1']

  for (const id in nodes.value) {
    updateNodeSize(nodes.value[id])
  }
}

// ==================== 视图控制 ====================
function centerView() {
  transform.reset()
  scheduleDraw()
}

function fitToScreen() {
  if (Object.keys(nodes.value).length === 0) {
    centerView()
    return
  }
  
  // 计算所有节点的边界
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  for (const id in nodes.value) {
    const node = nodes.value[id]
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x + node.width)
    minY = Math.min(minY, node.y)
    maxY = Math.max(maxY, node.y + node.height)
  }
  
  // 添加边距
  const padding = 100
  minX -= padding
  maxX += padding
  minY -= padding
  maxY += padding
  
  // 计算内容尺寸
  const contentWidth = maxX - minX
  const contentHeight = maxY - minY
  
  // 计算合适的缩放比例
  const { width, height } = getContainerSize()
  const scaleX = width / contentWidth
  const scaleY = height / contentHeight
  transform.scale = Math.min(scaleX, scaleY, 2)
  
  // 计算内容中心
  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2
  
  // 设置偏移（内容中心对齐到画布中心）
  transform.offsetX = -contentCenterX * transform.scale
  transform.offsetY = -contentCenterY * transform.scale
  
  scheduleDraw()
}

// ==================== 自动平移系统 ====================
function startAutoPan(mouseX, mouseY, containerWidth, containerHeight) {
  if (isAutoPanning.value) return
  
  isAutoPanning.value = true
  
  function autoPanLoop() {
    if (!isAutoPanning.value || !isDraggingNode.value) {
      stopAutoPan()
      return
    }
    
    // 计算鼠标相对于容器的位置
    const rect = containerRef.value.getBoundingClientRect()
    const relativeMouseX = mouseX - rect.left
    const relativeMouseY = mouseY - rect.top
    
    let panX = 0
    let panY = 0
    
    // 检测左边缘
    if (relativeMouseX < edgeThreshold) {
      panX = autoPanSpeed
    }
    // 检测右边缘
    else if (relativeMouseX > containerWidth - edgeThreshold) {
      panX = -autoPanSpeed
    }
    
    // 检测上边缘
    if (relativeMouseY < edgeThreshold) {
      panY = autoPanSpeed
    }
    // 检测下边缘
    else if (relativeMouseY > containerHeight - edgeThreshold) {
      panY = -autoPanSpeed
    }
    
    // 如果需要平移
    if (panX !== 0 || panY !== 0) {
      transform.offsetX += panX
      transform.offsetY += panY
      
      // 同时移动正在拖动的节点
      if (dragNodeId.value) {
        const worldPoint = transform.screenToWorld(
          relativeMouseX,
          relativeMouseY,
          containerWidth,
          containerHeight
        )
        
        let newRootX = worldPoint.x - dragOffsetX.value
        let newRootY = worldPoint.y - dragOffsetY.value
        
        const deltaX = newRootX - dragNodePositions.value[dragNodeId.value].x
        const deltaY = newRootY - dragNodePositions.value[dragNodeId.value].y
        
        for (const nodeId of dragNodeIds.value) {
          const node = nodes.value[nodeId]
          if (node) {
            node.x = dragNodePositions.value[nodeId].x + deltaX
            node.y = dragNodePositions.value[nodeId].y + deltaY
          }
        }
      }
      
      scheduleDraw()
    }
    
    autoPanAnimationFrameId = requestAnimationFrame(autoPanLoop)
  }
  
  autoPanAnimationFrameId = requestAnimationFrame(autoPanLoop)
}

function stopAutoPan() {
  isAutoPanning.value = false
  if (autoPanAnimationFrameId) {
    cancelAnimationFrame(autoPanAnimationFrameId)
    autoPanAnimationFrameId = null
  }
}

function checkEdgeAndAutoPan(mouseX, mouseY, containerWidth, containerHeight) {
  const rect = containerRef.value.getBoundingClientRect()
  const relativeMouseX = mouseX - rect.left
  const relativeMouseY = mouseY - rect.top
  
  // 检查鼠标是否在边缘区域
  const isNearLeftEdge = relativeMouseX < edgeThreshold
  const isNearRightEdge = relativeMouseX > containerWidth - edgeThreshold
  const isNearTopEdge = relativeMouseY < edgeThreshold
  const isNearBottomEdge = relativeMouseY > containerHeight - edgeThreshold
  
  if (isNearLeftEdge || isNearRightEdge || isNearTopEdge || isNearBottomEdge) {
    startAutoPan(mouseX, mouseY, containerWidth, containerHeight)
  } else {
    stopAutoPan()
  }
}

// ==================== 高亮动画系统 ====================
function startHighlightAnimation(nodeId) {
  highlightAnimation.value = {
    active: true,
    progress: 0,
    targetNodeId: nodeId
  }
  
  if (highlightAnimationFrameId) {
    cancelAnimationFrame(highlightAnimationFrameId)
  }
  
  function animate() {
    highlightAnimation.value.progress += 0.08
    
    if (highlightAnimation.value.progress >= 1) {
      highlightAnimation.value.progress = 1
      highlightAnimationFrameId = null
    } else {
      highlightAnimationFrameId = requestAnimationFrame(animate)
    }
    
    scheduleDraw()
  }
  
  highlightAnimationFrameId = requestAnimationFrame(animate)
}

function stopHighlightAnimation() {
  highlightAnimation.value.active = false
  highlightAnimation.value.progress = 0
  highlightAnimation.value.targetNodeId = null
  
  if (highlightAnimationFrameId) {
    cancelAnimationFrame(highlightAnimationFrameId)
    highlightAnimationFrameId = null
  }
  
  scheduleDraw()
}

// ==================== 节点动画系统 ====================
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function startNodeAnimation(nodeId, type, fromX, fromY, toX, toY) {
  nodeAnimations.value.set(nodeId, {
    type,
    progress: 0,
    fromX,
    fromY,
    toX,
    toY
  })
  
  if (!nodeAnimationFrameId) {
    animateNodes()
  }
}

function animateNodes() {
  let hasActiveAnimations = false
  
  for (const [nodeId, animation] of nodeAnimations.value) {
    animation.progress += 0.05
    
    if (animation.progress >= 1) {
      animation.progress = 1
      nodeAnimations.value.delete(nodeId)
    } else {
      hasActiveAnimations = true
    }
  }
  
  if (hasActiveAnimations) {
    nodeAnimationFrameId = requestAnimationFrame(animateNodes)
  } else {
    nodeAnimationFrameId = null
  }
  
  scheduleDraw()
}

function stopAllNodeAnimations() {
  nodeAnimations.value.clear()
  if (nodeAnimationFrameId) {
    cancelAnimationFrame(nodeAnimationFrameId)
    nodeAnimationFrameId = null
  }
  scheduleDraw()
}

// ==================== 绘制函数（成熟的渲染系统）====================
function drawBackground(width, height, dpr) {
  // 绘制渐变背景
  const gradient = ctx.value.createLinearGradient(0, 0, 0, height * dpr)
  gradient.addColorStop(0, '#f8fafc')
  gradient.addColorStop(1, '#f1f5f9')
  ctx.value.fillStyle = gradient
  ctx.value.fillRect(0, 0, width * dpr, height * dpr)
  
  // 绘制网格
  const gridSize = 30 * dpr
  ctx.value.strokeStyle = 'rgba(148, 163, 184, 0.1)'
  ctx.value.lineWidth = 1
  
  ctx.value.beginPath()
  // 垂直线
  for (let x = 0; x <= width * dpr; x += gridSize) {
    ctx.value.moveTo(x, 0)
    ctx.value.lineTo(x, height * dpr)
  }
  // 水平线
  for (let y = 0; y <= height * dpr; y += gridSize) {
    ctx.value.moveTo(0, y)
    ctx.value.lineTo(width * dpr, y)
  }
  ctx.value.stroke()
}

function draw() {
  if (!ctx.value) return
  
  const { width, height } = getContainerSize()
  const dpr = window.devicePixelRatio || 1
  
  // 重置变换并清除整个Canvas
  ctx.value.setTransform(1, 0, 0, 1, 0, 0)
  ctx.value.clearRect(0, 0, width * dpr, height * dpr)
  
  // 绘制背景
  drawBackground(width, height, dpr)
  
  // 应用变换矩阵（包含DPR缩放）
  transform.apply(ctx.value, width, height, dpr)
  
  const visibleNodeIds = getVisibleNodeIds()
  drawLines(visibleNodeIds)
  drawNodes(visibleNodeIds)
}

function scheduleDraw() {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(() => {
      draw()
      animationFrameId = null
    })
  }
}

function drawLines(visibleNodeIds) {
  const dpr = window.devicePixelRatio || 1
  const baseLineWidth = 2 / transform.scale / dpr
  const selectedLineWidth = 3 / transform.scale / dpr
  
  for (const id in nodes.value) {
    const node = nodes.value[id]
    if (node.parentId && nodes.value[node.parentId] && visibleNodeIds.includes(id)) {
      const parent = nodes.value[node.parentId]
      let startX, startY, endX, endY

      // 获取父节点的布局方向
      // 如果父节点本身是一个根节点（在rootIds数组中），并且有自己的布局方向，则使用自己的布局方向
      // 否则，继承其根节点的布局方向
      let parentLayoutDirection = parent.layoutDirection
      
      // 如果父节点本身是一个根节点，并且有自己的布局方向，则使用自己的布局方向
      if (rootIds.value.includes(parent.id) && parentLayoutDirection) {
        // 使用父节点自己的布局方向
      } else if (!parentLayoutDirection && parent.parentId) {
        // 如果父节点没有布局方向，则继承其根节点的布局方向
        let rootNode = nodes.value[parent.parentId]
        while (rootNode && rootNode.parentId && !rootIds.value.includes(rootNode.id)) {
          rootNode = nodes.value[rootNode.parentId]
        }
        if (rootNode && rootNode.layoutDirection) {
          parentLayoutDirection = rootNode.layoutDirection
        }
      }
      
      if (!parentLayoutDirection) {
        parentLayoutDirection = 'left-right' // 默认布局方向
      }

      if (parentLayoutDirection === 'left-right') {
        startX = parent.x + parent.width
        startY = parent.y + parent.height / 2
        endX = node.x
        endY = node.y + node.height / 2
      } else {
        startX = parent.x + parent.width / 2
        startY = parent.y + parent.height
        endX = node.x + node.width / 2
        endY = node.y
      }

      const isSelected = selectedConnection.value &&
        selectedConnection.value.parentId === parent.id &&
        selectedConnection.value.childId === node.id

      // 使用贝塞尔曲线绘制连接线，更平滑
      ctx.value.beginPath()
      
      if (isSelected) {
        ctx.value.strokeStyle = '#42b883'
        ctx.value.lineWidth = selectedLineWidth
        ctx.value.shadowColor = 'rgba(66, 184, 131, 0.3)'
        ctx.value.shadowBlur = 8 / transform.scale / dpr
      } else {
        ctx.value.strokeStyle = '#94a3b8'
        ctx.value.lineWidth = baseLineWidth
        ctx.value.shadowColor = 'transparent'
        ctx.value.shadowBlur = 0
      }
      
      if (parentLayoutDirection === 'left-right') {
        // 水平布局：使用三次贝塞尔曲线
        const cp1X = startX + (endX - startX) * 0.5
        const cp1Y = startY
        const cp2X = cp1X
        const cp2Y = endY
        ctx.value.moveTo(startX, startY)
        ctx.value.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)
      } else {
        // 垂直布局：使用三次贝塞尔曲线
        const cp1X = startX
        const cp1Y = startY + (endY - startY) * 0.5
        const cp2X = endX
        const cp2Y = cp1Y
        ctx.value.moveTo(startX, startY)
        ctx.value.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY)
      }
      
      ctx.value.stroke()
      ctx.value.shadowColor = 'transparent'
      ctx.value.shadowBlur = 0
    }
  }
}

function drawNodes(visibleNodeIds) {
  const dpr = window.devicePixelRatio || 1
  const fontSize = 14 * dpr
  const nodeBorderWidth = 1.5 / transform.scale / dpr
  const selectionOffset = 4 / transform.scale / dpr
  const selectionBorderWidth = 2.5 / transform.scale / dpr
  const indicatorRadius = 6 / transform.scale / dpr
  const cornerRadius = 6 / transform.scale / dpr
  
  for (const id of visibleNodeIds) {
    const node = nodes.value[id]
    if (!node) continue

    const isSelected = selectedNodeId.value === node.id
    const isHighlighting = highlightAnimation.value.active && highlightAnimation.value.targetNodeId === node.id
    
    // 检查节点动画
    const animation = nodeAnimations.value.get(node.id)
    let drawX = node.x
    let drawY = node.y
    let drawWidth = node.width
    let drawHeight = node.height
    let globalAlpha = 1
    
    if (animation) {
      const easedProgress = easeOutCubic(animation.progress)
      
      if (animation.type === 'create') {
        // 创建动画：从父节点位置淡入并移动到目标位置
        drawX = animation.fromX + (animation.toX - animation.fromX) * easedProgress
        drawY = animation.fromY + (animation.toY - animation.fromY) * easedProgress
        globalAlpha = easedProgress
      } else if (animation.type === 'delete') {
        // 删除动画：淡出并缩小
        drawX = animation.fromX + (animation.toX - animation.fromX) * easedProgress
        drawY = animation.fromY + (animation.toY - animation.fromY) * easedProgress
        globalAlpha = 1 - easedProgress
        drawWidth = node.width * (1 - easedProgress * 0.5)
        drawHeight = node.height * (1 - easedProgress * 0.5)
      } else if (animation.type === 'move') {
        // 移动动画：平滑移动到新位置
        drawX = animation.fromX + (animation.toX - animation.fromX) * easedProgress
        drawY = animation.fromY + (animation.toY - animation.fromY) * easedProgress
      }
    }
    
    // 保存当前上下文状态
    ctx.value.save()
    
    // 应用透明度
    ctx.value.globalAlpha = globalAlpha
    
    // 绘制节点阴影
    ctx.value.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.value.shadowBlur = 12 / transform.scale / dpr
    ctx.value.shadowOffsetX = 3 / transform.scale / dpr
    ctx.value.shadowOffsetY = 3 / transform.scale / dpr
    
    // 绘制节点背景（圆角矩形）
    ctx.value.beginPath()
    ctx.value.roundRect(drawX, drawY, drawWidth, drawHeight, cornerRadius)
    
    // 创建渐变背景
    const gradient = ctx.value.createLinearGradient(
      drawX, drawY,
      drawX, drawY + drawHeight
    )
    const isHovered = hoveredNodeId.value === node.id
    if (isSelected || isHighlighting) {
      gradient.addColorStop(0, '#dcfce7')
      gradient.addColorStop(0.5, '#f0fdf4')
      gradient.addColorStop(1, '#ffffff')
    } else if (isHovered) {
      gradient.addColorStop(0, '#fef9c3')
      gradient.addColorStop(0.5, '#fefce8')
      gradient.addColorStop(1, '#ffffff')
    } else {
      gradient.addColorStop(0, '#f8fafc')
      gradient.addColorStop(0.5, '#ffffff')
      gradient.addColorStop(1, '#f1f5f9')
    }
    ctx.value.fillStyle = gradient
    ctx.value.fill()
    
    // 绘制节点边框
    ctx.value.shadowColor = 'transparent'
    if (isSelected || isHighlighting) {
      ctx.value.strokeStyle = '#42b883'
    } else if (isHovered) {
      ctx.value.strokeStyle = '#f59e0b'
    } else {
      ctx.value.strokeStyle = '#e2e8f0'
    }
    ctx.value.lineWidth = nodeBorderWidth
    ctx.value.stroke()

    // 文本截断处理
    ctx.value.fillStyle = '#1e293b'
    ctx.value.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    const maxWidth = drawWidth - 20
    const text = truncateText(ctx.value, node.text, maxWidth)
    ctx.value.fillText(text, drawX + 10, drawY + 25)

    // 绘制折叠指示器
    if (node.children && node.children.length > 0) {
      ctx.value.shadowColor = 'rgba(0, 0, 0, 0.15)'
      ctx.value.shadowBlur = 6 / transform.scale / dpr
      ctx.value.shadowOffsetX = 1.5 / transform.scale / dpr
      ctx.value.shadowOffsetY = 1.5 / transform.scale / dpr
      
      ctx.value.beginPath()
      ctx.value.arc(
        drawX + drawWidth - indicatorRadius * 2.5,
        drawY + drawHeight / 2,
        indicatorRadius * 1.1,
        0,
        Math.PI * 2
      )
      
      if (node.collapsed) {
        ctx.value.fillStyle = '#42b883'
      } else {
        ctx.value.fillStyle = '#94a3b8'
      }
      ctx.value.fill()
      
      // 绘制指示器边框
      ctx.value.shadowColor = 'transparent'
      ctx.value.strokeStyle = '#ffffff'
      ctx.value.lineWidth = 2 / transform.scale / dpr
      ctx.value.stroke()
      
      // 绘制指示器图标（+ 或 -）
      ctx.value.fillStyle = '#ffffff'
      ctx.value.font = `bold ${indicatorRadius * 1.2}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
      ctx.value.textAlign = 'center'
      ctx.value.textBaseline = 'middle'
      ctx.value.fillText(
        node.collapsed ? '+' : '−',
        drawX + drawWidth - indicatorRadius * 2.5,
        drawY + drawHeight / 2 + indicatorRadius * 0.1
      )
    }

    // 绘制选中高亮效果（带动画）
    if (isSelected || isHighlighting) {
      // 计算动画进度
      const progress = isHighlighting ? highlightAnimation.value.progress : 1
      
      // 动画发光效果
      const glowIntensity = 0.4 * progress
      const glowBlur = 12 / transform.scale / dpr * (0.5 + 0.5 * progress)
      const extraOffset = selectionOffset * (1 - 0.3 * progress)
      
      ctx.value.shadowColor = `rgba(66, 184, 131, ${glowIntensity})`
      ctx.value.shadowBlur = glowBlur
      ctx.value.shadowOffsetX = 0
      ctx.value.shadowOffsetY = 0
      
      ctx.value.beginPath()
      ctx.value.roundRect(
        drawX - extraOffset,
        drawY - extraOffset,
        drawWidth + extraOffset * 2,
        drawHeight + extraOffset * 2,
        cornerRadius + 2
      )
      ctx.value.strokeStyle = '#42b883'
      ctx.value.lineWidth = selectionBorderWidth
      ctx.value.stroke()
      
      // 重置阴影
      ctx.value.shadowColor = 'transparent'
      ctx.value.shadowBlur = 0
      ctx.value.shadowOffsetX = 0
      ctx.value.shadowOffsetY = 0
    }
    
    // 恢复上下文状态
    ctx.value.restore()
  }
}

// 文本截断处理
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text
  }
  
  let truncated = text
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1)
  }
  
  return truncated + '...'
}

// ==================== 节点查找和可见性 ====================
function findNodeAt(worldX, worldY) {
  for (const id in nodes.value) {
    const node = nodes.value[id]
    if (worldX >= node.x && worldX <= node.x + node.width &&
        worldY >= node.y && worldY <= node.y + node.height) {
      return node
    }
  }
  return null
}

function getNodeAndDescendants(nodeId) {
  const result = [nodeId]
  const node = nodes.value[nodeId]
  if (node && !node.collapsed && node.children) {
    for (const childId of node.children) {
      result.push(...getNodeAndDescendants(childId))
    }
  }
  return result
}

function getVisibleNodeIds() {
  const visibleIds = new Set()
  const { width, height } = getContainerSize()
  const dpr = window.devicePixelRatio || 1
  
  // 计算视口边界（世界坐标）
  const topLeft = transform.screenToWorld(0, 0, width, height)
  const bottomRight = transform.screenToWorld(width * dpr, height * dpr, width, height)
  
  function traverse(nodeId) {
    const node = nodes.value[nodeId]
    if (!node) return
    
    // 检查节点是否在视口内（添加一些边距）
    const padding = 100
    const isInViewport =
      node.x + node.width >= topLeft.x - padding &&
      node.x <= bottomRight.x + padding &&
      node.y + node.height >= topLeft.y - padding &&
      node.y <= bottomRight.y + padding
    
    if (isInViewport) {
      visibleIds.add(nodeId)
    }
    
    if (!node.collapsed && node.children) {
      for (const childId of node.children) {
        traverse(childId)
      }
    }
  }
  
  for (const rootId of rootIds.value) {
    traverse(rootId)
  }
  
  return Array.from(visibleIds)
}

// ==================== 节点尺寸计算 ====================
function calculateNodeSize(text) {
  if (!ctx.value) {
    return { width: 100, height: 40 }
  }
  ctx.value.font = '14px Arial'
  const metrics = ctx.value.measureText(text)
  const padding = 20
  const minWidth = 100
  const width = Math.max(minWidth, metrics.width + padding)
  const height = 40
  return { width, height }
}

function updateNodeSize(node) {
  const size = calculateNodeSize(node.text)
  node.width = size.width
  node.height = size.height
}

// ==================== 节点操作 ====================
function toggleNodeCollapse(nodeId) {
  const node = nodes.value[nodeId]
  if (node && node.children && node.children.length > 0) {
    node.collapsed = !node.collapsed
    scheduleDraw()
  }
}

function toggleLayoutDirection() {
  // 如果有选中的节点，找到其根节点并切换布局方向
  if (selectedNodeId.value) {
    const node = nodes.value[selectedNodeId.value]
    if (node) {
      // 找到根节点
      let rootNode = node
      while (rootNode.parentId && nodes.value[rootNode.parentId]) {
        rootNode = nodes.value[rootNode.parentId]
      }
      
      // 切换根节点的布局方向
      rootNode.layoutDirection = rootNode.layoutDirection === 'left-right' ? 'top-bottom' : 'left-right'
      
      // 重新布局该根节点及其子树
      layoutSubtree(rootNode.id, rootNode.x, rootNode.y)
      
      // 保存状态
      saveState()
      
      // 触发状态变化事件
      emit('layout-changed', rootNode.layoutDirection)
    }
  } else if (rootIds.value.length > 0) {
    // 如果没有选中节点，但存在根节点，切换第一个根节点的布局方向
    const rootNode = nodes.value[rootIds.value[0]]
    if (rootNode) {
      rootNode.layoutDirection = rootNode.layoutDirection === 'left-right' ? 'top-bottom' : 'left-right'
      
      // 重新布局该根节点及其子树
      layoutSubtree(rootNode.id, rootNode.x, rootNode.y)
      
      // 保存状态
      saveState()
      
      // 触发状态变化事件
      emit('layout-changed', rootNode.layoutDirection)
    }
  }
  
  scheduleDraw()
}

// ==================== 树形布局算法 ====================
function calculateSubtreeSize(nodeId) {
  const node = nodes.value[nodeId]
  if (!node) return { width: 0, height: 0 }
  
  // 如果节点已折叠或没有子节点，返回节点自身的尺寸
  if (node.collapsed || !node.children || node.children.length === 0) {
    return { width: node.width, height: node.height }
  }
  
  // 递归计算所有子树的尺寸
  const childSizes = node.children.map(childId => calculateSubtreeSize(childId))
  
  // 获取节点的布局方向
  // 如果节点本身是一个根节点（在rootIds数组中），并且有自己的布局方向，则使用自己的布局方向
  // 否则，继承其根节点的布局方向
  let nodeLayoutDirection = node.layoutDirection
  
  // 如果节点本身是一个根节点，并且有自己的布局方向，则使用自己的布局方向
  if (rootIds.value.includes(nodeId) && nodeLayoutDirection) {
    // 使用节点自己的布局方向
  } else if (!nodeLayoutDirection && node.parentId) {
    // 如果节点没有布局方向，则继承其根节点的布局方向
    let rootNode = nodes.value[node.parentId]
    while (rootNode && rootNode.parentId && !rootIds.value.includes(rootNode.id)) {
      rootNode = nodes.value[rootNode.parentId]
    }
    if (rootNode && rootNode.layoutDirection) {
      nodeLayoutDirection = rootNode.layoutDirection
    }
  }
  
  if (!nodeLayoutDirection) {
    nodeLayoutDirection = 'left-right' // 默认布局方向
  }
  
  if (nodeLayoutDirection === 'left-right') {
    // 左右布局：子树垂直排列
    const totalHeight = childSizes.reduce((sum, size) => sum + size.height, 0)
    const maxWidth = Math.max(...childSizes.map(size => size.width))
    const gap = 20
    return {
      width: node.width + gap + maxWidth,
      height: Math.max(node.height, totalHeight + (childSizes.length - 1) * gap)
    }
  } else {
    // 上下布局：子树水平排列
    const totalWidth = childSizes.reduce((sum, size) => sum + size.width, 0)
    const maxHeight = Math.max(...childSizes.map(size => size.height))
    const gap = 20
    return {
      width: Math.max(node.width, totalWidth + (childSizes.length - 1) * gap),
      height: node.height + gap + maxHeight
    }
  }
}

function layoutSubtree(nodeId, x, y) {
  const node = nodes.value[nodeId]
  if (!node) return
  
  // 保存旧位置用于动画
  const oldX = node.x
  const oldY = node.y
  
  // 设置当前节点的位置
  node.x = x
  node.y = y
  
  // 启动移动动画（如果位置发生了变化）
  if (oldX !== x || oldY !== y) {
    startNodeAnimation(nodeId, 'move', oldX, oldY, x, y)
  }
  
  // 如果节点已折叠或没有子节点，直接返回
  if (node.collapsed || !node.children || node.children.length === 0) {
    return
  }
  
  // 获取节点的布局方向
  // 如果节点本身是一个根节点（在rootIds数组中），并且有自己的布局方向，则使用自己的布局方向
  // 否则，继承其根节点的布局方向
  let nodeLayoutDirection = node.layoutDirection
  
  // 如果节点本身是一个根节点，并且有自己的布局方向，则使用自己的布局方向
  if (rootIds.value.includes(nodeId) && nodeLayoutDirection) {
    // 使用节点自己的布局方向
  } else if (!nodeLayoutDirection && node.parentId) {
    // 如果节点没有布局方向，则继承其根节点的布局方向
    let rootNode = nodes.value[node.parentId]
    while (rootNode && rootNode.parentId && !rootIds.value.includes(rootNode.id)) {
      rootNode = nodes.value[rootNode.parentId]
    }
    if (rootNode && rootNode.layoutDirection) {
      nodeLayoutDirection = rootNode.layoutDirection
    }
  }
  
  if (!nodeLayoutDirection) {
    nodeLayoutDirection = 'left-right' // 默认布局方向
  }
  
  const gap = 20
  
  if (nodeLayoutDirection === 'left-right') {
    // 左右布局：子节点垂直排列
    const childX = x + node.width + gap
    
    // 计算所有子树的总高度
    const childSizes = node.children.map(childId => calculateSubtreeSize(childId))
    const totalHeight = childSizes.reduce((sum, size) => sum + size.height, 0) + (childSizes.length - 1) * gap
    
    // 计算起始Y坐标，使子树垂直居中
    let currentY = y + (node.height - totalHeight) / 2
    
    // 递归布局每个子树
    for (let i = 0; i < node.children.length; i++) {
      const childId = node.children[i]
      const childSize = childSizes[i]
      
      // 子树垂直居中于其分配的空间
      const childY = currentY + (childSize.height - nodes.value[childId].height) / 2
      
      layoutSubtree(childId, childX, childY)
      
      // 移动到下一个子树的位置
      currentY += childSize.height + gap
    }
  } else {
    // 上下布局：子节点水平排列
    const childY = y + node.height + gap
    
    // 计算所有子树的总宽度
    const childSizes = node.children.map(childId => calculateSubtreeSize(childId))
    const totalWidth = childSizes.reduce((sum, size) => sum + size.width, 0) + (childSizes.length - 1) * gap
    
    // 计算起始X坐标，使子树水平居中
    let currentX = x + (node.width - totalWidth) / 2
    
    // 递归布局每个子树
    for (let i = 0; i < node.children.length; i++) {
      const childId = node.children[i]
      const childSize = childSizes[i]
      
      // 子树水平居中于其分配的空间
      const childX = currentX + (childSize.width - nodes.value[childId].width) / 2
      
      layoutSubtree(childId, childX, childY)
      
      // 移动到下一个子树的位置
      currentX += childSize.width + gap
    }
  }
}

function relayoutNodes() {
  // 如果没有选中节点，则对所有根节点进行布局
  const targetNodeId = selectedNodeId.value || rootIds.value[0]
  
  if (!targetNodeId) return
  
  // 获取目标节点及其父节点链
  const nodeChain = []
  let currentNode = nodes.value[targetNodeId]
  while (currentNode) {
    nodeChain.unshift(currentNode)
    currentNode = currentNode.parentId ? nodes.value[currentNode.parentId] : null
  }
  
  // 从根节点开始重新布局
  if (nodeChain.length > 0) {
    const rootNode = nodeChain[0]
    layoutSubtree(rootNode.id, rootNode.x, rootNode.y)
  }
}

function deleteNode(nodeId) {
  const node = nodes.value[nodeId]
  if (!node) return

  const nodesToDelete = getNodeAndDescendants(nodeId)
  
  // 启动删除动画
  for (const id of nodesToDelete) {
    const deleteNode = nodes.value[id]
    if (deleteNode) {
      const toX = deleteNode.x + deleteNode.width / 2
      const toY = deleteNode.y + deleteNode.height / 2
      startNodeAnimation(id, 'delete', deleteNode.x, deleteNode.y, toX, toY)
    }
  }

  if (node.parentId) {
    const parent = nodes.value[node.parentId]
    if (parent) {
      parent.children = parent.children.filter(id => id !== nodeId)
    }
  } else {
    rootIds.value = rootIds.value.filter(id => id !== nodeId)
  }

  for (const id of nodesToDelete) {
    delete nodes.value[id]
  }

  selectedNodeId.value = null
  stopHighlightAnimation()
  saveState()
  scheduleDraw()
}

function addChildNode(parentId) {
  const parent = nodes.value[parentId]
  if (!parent) return

  const newId = `node_${++nodeIdCounter}`
  const newNode = {
    id: newId,
    text: '新节点',
    x: parent.x,
    y: parent.y,
    width: 100,
    height: 40,
    parentId: parentId,
    children: [],
    collapsed: false
  }

  nodes.value[newId] = newNode
  parent.children.push(newId)

  updateNodeSize(newNode)
  selectedNodeId.value = newId
  
  // 重新布局父节点及其子树，避免节点重叠
  layoutSubtree(parentId, parent.x, parent.y)
  
  // 启动创建动画：从父节点位置移动到目标位置
  const fromX = parent.x + parent.width / 2 - newNode.width / 2
  const fromY = parent.y + parent.height / 2 - newNode.height / 2
  startNodeAnimation(newId, 'create', fromX, fromY, newNode.x, newNode.y)
  
  saveState()
  scheduleDraw()
}

function addSiblingNode() {
  const selectedId = selectedNodeId.value
  if (!selectedId) return
  
  const selectedNode = nodes.value[selectedId]
  if (!selectedNode) return
  
  const parentId = selectedNode.parentId
  if (!parentId) {
    // 根节点没有同级节点，直接返回
    return
  }
  
  const parent = nodes.value[parentId]
  if (!parent) return
  
  const newId = `node_${++nodeIdCounter}`
  const newNode = {
    id: newId,
    text: '新节点',
    x: selectedNode.x,
    y: selectedNode.y,
    width: 100,
    height: 40,
    parentId: parentId,
    children: [],
    collapsed: false
  }
  
  nodes.value[newId] = newNode
  parent.children.push(newId)
  
  updateNodeSize(newNode)
  selectedNodeId.value = newId
  
  // 重新布局父节点及其子树，避免同级节点重叠
  layoutSubtree(parentId, parent.x, parent.y)
  
  // 启动创建动画：从父节点位置移动到目标位置
  const fromX = parent.x + parent.width / 2 - newNode.width / 2
  const fromY = parent.y + parent.height / 2 - newNode.height / 2
  startNodeAnimation(newId, 'create', fromX, fromY, newNode.x, newNode.y)
  
  saveState()
  scheduleDraw()
}

function createRootNode(x, y) {
  const newId = `node_${++nodeIdCounter}`
  const newNode = {
    id: newId,
    text: '根节点',
    x: x,
    y: y,
    width: 100,
    height: 40,
    parentId: null,
    children: [],
    collapsed: false,
    layoutDirection: 'left-right' // 默认布局方向
  }

  nodes.value[newId] = newNode
  rootIds.value.push(newId)

  updateNodeSize(newNode)
  selectedNodeId.value = newId
  saveState()
  scheduleDraw()
}

// ==================== 连接线操作 ====================
function findConnectionAt(worldX, worldY) {
  const visibleNodeIds = getVisibleNodeIds()
  const threshold = 10

  for (const id in nodes.value) {
    const node = nodes.value[id]
    if (node.parentId && nodes.value[node.parentId] && visibleNodeIds.includes(id)) {
      const parent = nodes.value[node.parentId]
      let startX, startY, endX, endY

      // 获取父节点的布局方向
      // 如果父节点本身是一个根节点（在rootIds数组中），并且有自己的布局方向，则使用自己的布局方向
      // 否则，继承其根节点的布局方向
      let parentLayoutDirection = parent.layoutDirection
      
      // 如果父节点本身是一个根节点，并且有自己的布局方向，则使用自己的布局方向
      if (rootIds.value.includes(parent.id) && parentLayoutDirection) {
        // 使用父节点自己的布局方向
      } else if (!parentLayoutDirection && parent.parentId) {
        // 如果父节点没有布局方向，则继承其根节点的布局方向
        let rootNode = nodes.value[parent.parentId]
        while (rootNode && rootNode.parentId && !rootIds.value.includes(rootNode.id)) {
          rootNode = nodes.value[rootNode.parentId]
        }
        if (rootNode && rootNode.layoutDirection) {
          parentLayoutDirection = rootNode.layoutDirection
        }
      }
      
      if (!parentLayoutDirection) {
        parentLayoutDirection = 'left-right' // 默认布局方向
      }

      if (parentLayoutDirection === 'left-right') {
        startX = parent.x + parent.width
        startY = parent.y + parent.height / 2
        endX = node.x
        endY = node.y + node.height / 2
      } else {
        startX = parent.x + parent.width / 2
        startY = parent.y + parent.height
        endX = node.x + node.width / 2
        endY = node.y
      }

      const distance = pointToLineDistance(worldX, worldY, startX, startY, endX, endY)
      if (distance < threshold) {
        return { parentId: parent.id, childId: node.id }
      }
    }
  }
  return null
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx, yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

function deleteConnection(parentId, childId) {
  const parent = nodes.value[parentId]
  const child = nodes.value[childId]

  if (parent && child) {
    parent.children = parent.children.filter(id => id !== childId)
    child.parentId = null
    rootIds.value.push(childId)

    selectedConnection.value = null
    saveState()
    scheduleDraw()
  }
}

// ==================== 事件处理（成熟的交互系统）====================
function onContextMenu(e) {
  // 完全阻止浏览器的右键菜单和手势
  e.preventDefault()
  e.stopPropagation()
  return false
}

function onWheel(e) {
  e.preventDefault()
  
  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  
  // 计算新的缩放比例
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const MIN_SCALE = 0.1
  const MAX_SCALE = 5.0
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * delta))
  
  // 以鼠标位置为中心缩放（使用变换矩阵）
  transform.zoomToPoint(newScale, mouseX, mouseY, rect.width, rect.height)
  
  scheduleDraw()
}

function handleKeyDown(e) {
  // 检查焦点是否在AI聊天窗口中
  const activeElement = document.activeElement
  const isInChatWindow = activeElement && activeElement.closest('.chat-window')
  if (isInChatWindow) {
    // 如果焦点在AI聊天窗口中，不处理键盘快捷键
    return
  }

  if (editingNodeId.value) {
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
    redo()
    e.preventDefault()
    return
  }

  if (e.code === 'Delete' || e.code === 'Backspace') {
    if (selectedConnection.value) {
      deleteConnection(selectedConnection.value.parentId, selectedConnection.value.childId)
      e.preventDefault()
      return
    } else if (selectedNodeId.value) {
      deleteNode(selectedNodeId.value)
      e.preventDefault()
      return
    }
  }

  if (e.code === 'Enter' && selectedNodeId.value) {
    addChildNode(selectedNodeId.value)
    e.preventDefault()
    return
  }

  if (e.code === 'Tab' && selectedNodeId.value) {
    e.preventDefault()
    const node = nodes.value[selectedNodeId.value]
    if (node && node.parentId) {
      addChildNode(node.parentId)
    }
    return
  }

  if (selectedNodeId.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    const node = nodes.value[selectedNodeId.value]
    if (node) {
      const step = 10
      switch (e.code) {
        case 'ArrowUp':
          node.y -= step
          break
        case 'ArrowDown':
          node.y += step
          break
        case 'ArrowLeft':
          node.x -= step
          break
        case 'ArrowRight':
          node.x += step
          break
      }
      scheduleDraw()
      e.preventDefault()
    }
    return
  }

  if (e.code === 'KeyL') {
    toggleLayoutDirection()
    e.preventDefault()
    return
  }

  if (e.code === 'Equal' || e.code === 'NumpadAdd') {
    zoomIn()
    e.preventDefault()
    return
  }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
    zoomOut()
    e.preventDefault()
    return
  }

  if (e.code === 'Space') {
    isSpacePressed.value = true
    e.preventDefault()
    return
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    e.preventDefault()
    return
  }
}

function onMouseDown(e) {
  if (containerRef.value) {
    containerRef.value.focus()
  }

  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  
  // 转换为世界坐标
  const worldPoint = transform.screenToWorld(mouseX, mouseY, rect.width, rect.height)
  
  // 左键（button === 0）
  if (e.button === 0) {
    // 在创建节点模式下，左键点击空白处创建节点
    if (isCreateNodeMode.value) {
      const hitNode = findNodeAt(worldPoint.x, worldPoint.y)
      const hitConnection = findConnectionAt(worldPoint.x, worldPoint.y)
      
      // 只有点击空白处才创建节点
      if (!hitNode && !hitConnection) {
        createRootNode(worldPoint.x, worldPoint.y)

        const newNodeId = selectedNodeId.value
        if (newNodeId && nodes.value[newNodeId]) {
          const newNode = nodes.value[newNodeId]
          isDraggingNode.value = true
          dragNodeId.value = newNodeId
          dragOffsetX.value = worldPoint.x - newNode.x
          dragOffsetY.value = worldPoint.y - newNode.y
          hasNodeMoved.value = false
          isRightClickDrag.value = false
          dragNodeIds.value = [newNodeId]
          dragNodePositions.value = {
            [newNodeId]: { x: newNode.x, y: newNode.y }
          }
        }
      }
      e.preventDefault()
      return
    }
    
    // 非创建节点模式下，左键点击节点则拖动节点，否则平移画布
    const hitNode = findNodeAt(worldPoint.x, worldPoint.y)
    if (hitNode) {
      // 左键拖动节点
      selectedNodeId.value = hitNode.id
      selectedConnection.value = null
      isDraggingNode.value = true
      dragNodeId.value = hitNode.id
      dragOffsetX.value = worldPoint.x - hitNode.x
      dragOffsetY.value = worldPoint.y - hitNode.y
      hasNodeMoved.value = false

      isRightClickDrag.value = false
      // 如果按住空格键，只拖动单个节点；否则拖动所有子节点
      if (isSpacePressed.value) {
        dragNodeIds.value = [hitNode.id]
      } else {
        dragNodeIds.value = getNodeAndDescendants(hitNode.id)
      }

      dragNodePositions.value = {}
      for (const nodeId of dragNodeIds.value) {
        const node = nodes.value[nodeId]
        dragNodePositions.value[nodeId] = { x: node.x, y: node.y }
      }

      if (containerRef.value) {
        containerRef.value.focus()
      }

      // 触发状态变化事件以更新UI
      emitStateChanged()
      
      // 启动高亮动画
      if (hitNode) {
        startHighlightAnimation(hitNode.id)
      }

      e.preventDefault()
      return
    }
    
    // 左键点击空白处，平移画布
    isPanning.value = true
    panStartX.value = e.clientX
    panStartY.value = e.clientY
    containerRef.value.style.cursor = 'grabbing'
    e.preventDefault()
    return
  }
  
  // 右键（button === 2）平移画布
  if (e.button === 2) {
    isPanning.value = true
    panStartX.value = e.clientX
    panStartY.value = e.clientY
    containerRef.value.style.cursor = 'grabbing'
    e.preventDefault()
    return
  }
}

function onMouseMove(e) {
  // 更新悬停状态
  if (!isPanning.value && !isDraggingNode.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const worldPoint = transform.screenToWorld(mouseX, mouseY, rect.width, rect.height)
    const hitNode = findNodeAt(worldPoint.x, worldPoint.y)
    
    if (hitNode && hitNode.id !== hoveredNodeId.value) {
      hoveredNodeId.value = hitNode.id
      containerRef.value.style.cursor = 'pointer'
      scheduleDraw()
    } else if (!hitNode && hoveredNodeId.value) {
      hoveredNodeId.value = null
      containerRef.value.style.cursor = 'default'
      scheduleDraw()
    }
  }
  
  if (isPanning.value) {
    const dx = e.clientX - panStartX.value
    const dy = e.clientY - panStartY.value
    transform.offsetX += dx
    transform.offsetY += dy
    panStartX.value = e.clientX
    panStartY.value = e.clientY
    scheduleDraw()
    e.preventDefault()
  } else if (isDraggingNode.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // 检查是否接近边缘并触发自动平移
    checkEdgeAndAutoPan(e.clientX, e.clientY, rect.width, rect.height)
    
    const worldPoint = transform.screenToWorld(mouseX, mouseY, rect.width, rect.height)
    const rootNode = nodes.value[dragNodeId.value]
    if (rootNode) {
      let newRootX = worldPoint.x - dragOffsetX.value
      let newRootY = worldPoint.y - dragOffsetY.value

      const deltaX = newRootX - dragNodePositions.value[dragNodeId.value].x
      const deltaY = newRootY - dragNodePositions.value[dragNodeId.value].y

      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        hasNodeMoved.value = true
      }

      for (const nodeId of dragNodeIds.value) {
        const node = nodes.value[nodeId]
        if (node) {
          node.x = dragNodePositions.value[nodeId].x + deltaX
          node.y = dragNodePositions.value[nodeId].y + deltaY
        }
      }

      scheduleDraw()
    }
    e.preventDefault()
  }
}

function onMouseUp(e) {
  // 停止自动平移
  stopAutoPan()
  
  if (isPanning.value) {
    isPanning.value = false
    containerRef.value.style.cursor = isSpacePressed.value ? 'grab' : 'default'
  }
  if (isDraggingNode.value) {
    if (hasNodeMoved.value) {
      saveState()
    }
    isDraggingNode.value = false
    dragNodeId.value = null
    dragNodeIds.value = []
    hasNodeMoved.value = false
    isRightClickDrag.value = false
    dragNodePositions.value = {}
  }
}

function onMouseLeave(e) {
  if (isPanning.value || isDraggingNode.value) {
    onMouseUp(e)
  }
}

function onDblClick(e) {
  const rect = containerRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  
  const worldPoint = transform.screenToWorld(mouseX, mouseY, rect.width, rect.height)
  const hitNode = findNodeAt(worldPoint.x, worldPoint.y)
  
  if (hitNode) {
    const indicatorX = hitNode.x + hitNode.width - 10
    const indicatorY = hitNode.y + hitNode.height / 2
    const distance = Math.sqrt(Math.pow(worldPoint.x - indicatorX, 2) + Math.pow(worldPoint.y - indicatorY, 2))

    if (hitNode.children && hitNode.children.length > 0 && distance <= 10) {
      toggleNodeCollapse(hitNode.id)
    } else {
      editingNodeId.value = hitNode.id
      editingText.value = hitNode.text

      const screenPoint = transform.worldToScreen(hitNode.x, hitNode.y, rect.width, rect.height)
      editorPosition.x = screenPoint.x
      editorPosition.y = screenPoint.y

      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
}

function finishEdit() {
  if (editingNodeId.value) {
    const node = nodes.value[editingNodeId.value]
    if (node) {
      node.text = editingText.value
      updateNodeSize(node)
    }
    editingNodeId.value = null
    saveState()
    scheduleDraw()

    nextTick(() => {
      if (containerRef.value) {
        containerRef.value.focus()
      }
    })
  }
}

// ==================== 缩放控制 ====================
function zoomIn() {
  const { width, height } = getContainerSize()
  const centerX = width / 2
  const centerY = height / 2
  
  const newScale = Math.min(5.0, transform.scale * 1.1)
  transform.zoomToPoint(newScale, centerX, centerY, width, height)
  scheduleDraw()
}

function zoomOut() {
  const { width, height } = getContainerSize()
  const centerX = width / 2
  const centerY = height / 2
  
  const newScale = Math.max(0.1, transform.scale * 0.9)
  transform.zoomToPoint(newScale, centerX, centerY, width, height)
  scheduleDraw()
}

function resetView() {
  transform.reset()
  scheduleDraw()
}

// ==================== API接口 ====================
function getMindMapData() {
  return {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value))
  }
}

function loadMindMapData(data) {
  nodes.value = data.nodes
  rootIds.value = data.rootIds
  
  let maxId = 0
  for (const id in nodes.value) {
    const match = id.match(/node_(\d+)/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxId) {
        maxId = num
      }
    }
  }
  nodeIdCounter = maxId
  
  scheduleDraw()
}

function exportAsPNG() {
  return canvasRef.value.toDataURL('image/png')
}

function clearCanvas() {
  nodes.value = {}
  rootIds.value = []
  nodeIdCounter = 0
  undoStack.value = []
  redoStack.value = []
  transform.reset()
  selectedNodeId.value = null
  selectedConnection.value = null
  scheduleDraw()
}

function getLayoutDirection() {
  // 如果有选中的节点，返回其根节点的布局方向
  if (selectedNodeId.value) {
    const node = nodes.value[selectedNodeId.value]
    if (node) {
      // 找到根节点
      let rootNode = node
      while (rootNode.parentId && nodes.value[rootNode.parentId]) {
        rootNode = nodes.value[rootNode.parentId]
      }
      
      // 返回根节点的布局方向
      return rootNode.layoutDirection || 'left-right'
    }
  } else if (rootIds.value.length > 0) {
    // 如果没有选中节点，但存在根节点，返回第一个根节点的布局方向
    const rootNode = nodes.value[rootIds.value[0]]
    if (rootNode) {
      return rootNode.layoutDirection || 'left-right'
    }
  }
  
  return 'left-right' // 默认布局方向
}

function setLayoutDirection(direction) {
  // 如果有选中的节点，找到其根节点并设置布局方向
  if (selectedNodeId.value) {
    const node = nodes.value[selectedNodeId.value]
    if (node) {
      // 找到根节点
      let rootNode = node
      while (rootNode.parentId && nodes.value[rootNode.parentId]) {
        rootNode = nodes.value[rootNode.parentId]
      }
      
      // 设置根节点的布局方向
      rootNode.layoutDirection = direction
      
      // 重新布局该根节点及其子树
      layoutSubtree(rootNode.id, rootNode.x, rootNode.y)
      
      // 保存状态
      saveState()
      
      // 触发状态变化事件
      emit('layout-changed', direction)
    }
  } else if (rootIds.value.length > 0) {
    // 如果没有选中节点，但存在根节点，设置第一个根节点的布局方向
    const rootNode = nodes.value[rootIds.value[0]]
    if (rootNode) {
      rootNode.layoutDirection = direction
      
      // 重新布局该根节点及其子树
      layoutSubtree(rootNode.id, rootNode.x, rootNode.y)
      
      // 保存状态
      saveState()
      
      // 触发状态变化事件
      emit('layout-changed', direction)
    }
  }
  
  scheduleDraw()
}

// ==================== 创建节点模式 ====================
function toggleCreateNodeMode() {
  isCreateNodeMode.value = !isCreateNodeMode.value
}

function getCreateNodeMode() {
  return isCreateNodeMode.value
}

// 暴露给父组件的API接口
defineExpose({
  getMindMapData,
  loadMindMapData,
  exportAsPNG,
  clearCanvas,
  getLayoutDirection,
  setLayoutDirection,
  getScale: () => transform.scale,
  getSelectedNodeId: () => selectedNodeId.value,
  getSelectedConnection: () => selectedConnection.value,
  getUndoStack: () => undoStack.value,
  getRedoStack: () => redoStack.value,
  undo,
  redo,
  deleteNode,
  addChildNode,
  addSiblingNode,
  zoomIn,
  zoomOut,
  resetView,
  fitToScreen,
  centerView,
  toggleCreateNodeMode,
  getCreateNodeMode
})
</script>

<style scoped>
.mind-map-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: default;
  outline: none;
  background-color: #f5f5f5;
  /* 禁用浏览器手势和选择 */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.node-editor {
  position: absolute;
  z-index: 10;
}

.node-editor input {
  font-size: 16px;
  padding: 4px 8px;
  border: 2px solid #42b883;
  border-radius: 4px;
  outline: none;
  width: 200px;
}
</style>
