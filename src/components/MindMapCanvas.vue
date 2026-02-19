<template>
  <div
    class="mind-map-canvas"
    ref="containerRef"
    tabindex="0" 
    @wheel="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @dblclick="onDblClick"
  >
    <canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight"></canvas>

    <!--浮动输入框（双击调用）-->
    <div
      v-if="editingNodeId"
      class="node-editor"
      :style="{ left: editorPosition.x + 'px', top: editorPosition.y + 'px', position: 'absolute' }"
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

const canvasRef = ref(null)
const containerRef = ref(null)
const inputRef = ref(null)
const ctx = ref(null)//保存 canvas 的 2D 绘图上下文
let animationFrameId = null//动画帧ID，用于性能优化
let nodeIdCounter = 0//节点ID自增计数器

//撤销/重做功能
const undoStack = ref([])//撤销栈
const redoStack = ref([])//重做栈
const MAX_HISTORY = 50//最大历史记录数

//画布状态
//逻辑尺寸
const canvasWidth = ref(2000)
const canvasHeight = ref(2000)
//放缩比例和平移偏量
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

//节点储存
const nodes = ref({})//全部节点
const rootIds = ref([])//根节点存储


//交互状态
//画布平移
const isPanning = ref(false)//是否平移画布

//节点拖拽
const isDraggingNode = ref(false)//是否拖拽节点
const dragNodeId = ref(null)//被拖拽节点的id
const dragOffsetX = ref(0)//节点拖拽偏量（相对于节点左上角）
const dragOffsetY = ref(0)//节点拖拽偏量（相对于节点左上角）
const dragNodeIds = ref([])//被拖拽的所有节点ID（包括子孙节点）
const dragNodePositions = reactive({})//被拖拽节点的初始位置
const hasNodeMoved = ref(false)//节点是否真的被移动了

//画布平移
const panStartX = ref(0)//平移起始X坐标
const panStartY = ref(0)//平移起始Y坐标

//选中节点
const selectedNodeId = ref(null)//选中节点亮显

//选中连接线
const selectedConnection = ref(null)//选中的连接线 { parentId, childId }

//编辑节点
const editingNodeId = ref(null)//节点id
const editingText = ref('')//文本（输入框双向绑定）
const editorPosition = reactive({ x: 0, y: 0 })//输入框位置

//状态区分（画布平移和节点拖拽）
const isSpacePressed = ref(false)

//布局方向
const layoutDirection = ref('left-right') // 'left-right' 或 'top-bottom'


//生命周期钩子
onMounted(() => {
  ctx.value = canvasRef.value.getContext('2d')//获取canvas 的 2D 绘图上下文
  initDemoData()//初始化示例节点数据
  updateCanvasSize()//更新 Canvas 尺寸为窗口大小
  draw()//初次绘制画布

  //添加window全局监听
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 修复内存泄漏：取消待执行的动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', handleResize)
})


//更新 Canvas 尺寸为窗口大小
function updateCanvasSize() {
  if (containerRef.value) {
    canvasWidth.value = containerRef.value.clientWidth
    canvasHeight.value = containerRef.value.clientHeight
  }
}

//窗口大小变化处理
function handleResize() {
  updateCanvasSize()
  scheduleDraw()
}

//撤销/重做功能
//保存当前状态到历史记录
function saveState() {
  const state = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  undoStack.value.push(state)
  // 清空重做栈
  redoStack.value = []
  // 限制历史记录数量
  if (undoStack.value.length > MAX_HISTORY) {
    undoStack.value.shift()
  }
}

//撤销操作
function undo() {
  if (undoStack.value.length === 0) return

  // 保存当前状态到重做栈
  const currentState = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  redoStack.value.push(currentState)

  // 恢复上一个状态
  const previousState = undoStack.value.pop()
  nodes.value = previousState.nodes
  rootIds.value = previousState.rootIds
  nodeIdCounter = previousState.nodeIdCounter

  selectedNodeId.value = null
  scheduleDraw()
}

//重做操作
function redo() {
  if (redoStack.value.length === 0) return

  // 保存当前状态到撤销栈
  const currentState = {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value)),
    nodeIdCounter: nodeIdCounter
  }
  undoStack.value.push(currentState)

  // 恢复下一个状态
  const nextState = redoStack.value.pop()
  nodes.value = nextState.nodes
  rootIds.value = nextState.rootIds
  nodeIdCounter = nextState.nodeIdCounter

  selectedNodeId.value = null
  scheduleDraw()
}

//示例数据初始化
function initDemoData() {
  nodes.value = {
    '1': { id: '1', text: '根节点', x: 400, y: 300, width: 100, height: 40, parentId: null, children: ['2', '3'], collapsed: false },
    '2': { id: '2', text: '子节点1', x: 550, y: 250, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
    '3': { id: '3', text: '子节点2', x: 550, y: 350, width: 100, height: 40, parentId: '1', children: [], collapsed: false },
  }
  rootIds.value = ['1']

  // 为所有节点计算尺寸
  for (const id in nodes.value) {
    updateNodeSize(nodes.value[id])
  }
}


//主绘制函数
function draw() {
  if (!ctx.value) return
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  applyTransform()
  drawLines()
  drawNodes()
}

//性能优化：使用 requestAnimationFrame 调度绘制
function scheduleDraw() {
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(() => {
      draw()
      animationFrameId = null
    })
  }
}

//坐标变换函数
function applyTransform() {
  ctx.value.setTransform(1, 0, 0, 1, 0, 0)   // 重置为单位矩阵
  ctx.value.translate(offsetX.value, offsetY.value)  // 平移
  ctx.value.scale(scale.value, scale.value)          // 缩放
}

//绘制连线函数（考虑折叠）
function drawLines() {
  // 获取所有可见的节点ID（未折叠的节点）
  const visibleNodeIds = getVisibleNodeIds()

  //子父节点处理
  for (const id in nodes.value) {
    const node = nodes.value[id]
    // 只绘制可见节点的连线
    if (node.parentId && nodes.value[node.parentId] && visibleNodeIds.includes(id)) {
      const parent = nodes.value[node.parentId]
      let startX, startY, endX, endY

      if (layoutDirection.value === 'left-right') {
        // 左→右布局
        startX = parent.x + parent.width
        startY = parent.y + parent.height / 2
        endX = node.x
        endY = node.y + node.height / 2
      } else {
        // 上→下布局
        startX = parent.x + parent.width / 2
        startY = parent.y + parent.height
        endX = node.x + node.width / 2
        endY = node.y
      }

      // 检查是否是选中的连接线
      const isSelected = selectedConnection.value &&
        selectedConnection.value.parentId === parent.id &&
        selectedConnection.value.childId === node.id

      ctx.value.beginPath()
      //连线样式
      ctx.value.strokeStyle = isSelected ? '#42b883' : '#aaa'
      ctx.value.lineWidth = isSelected ? 3 : 2

      ctx.value.moveTo(startX, startY)
      ctx.value.lineTo(endX, endY)
      ctx.value.stroke()
    }
  }
}

//绘制节点函数
function drawNodes() {
  // 获取所有可见的节点ID（未折叠的节点）
  const visibleNodeIds = getVisibleNodeIds()

  for (const id of visibleNodeIds) {
    const node = nodes.value[id]
    if (!node) continue

    // 绘制矩形背景
    ctx.value.fillStyle = '#fff'
    ctx.value.strokeStyle = '#333'
    ctx.value.lineWidth = 2
    ctx.value.fillRect(node.x, node.y, node.width, node.height)
    ctx.value.strokeRect(node.x, node.y, node.width, node.height)

    // 绘制文字
    ctx.value.fillStyle = '#333'
    ctx.value.font = '14px Arial'
    ctx.value.fillText(node.text, node.x + 10, node.y + 25)

    // 如果节点有子节点，绘制折叠/展开指示器
    if (node.children && node.children.length > 0) {
      ctx.value.fillStyle = node.collapsed ? '#42b883' : '#aaa'
      ctx.value.beginPath()
      ctx.value.arc(node.x + node.width - 10, node.y + node.height / 2, 5, 0, Math.PI * 2)
      ctx.value.fill()
    }

    // 如果是选中的节点，加一个绿色外框
    if (selectedNodeId.value === node.id) {
      ctx.value.strokeStyle = '#42b883'
      ctx.value.lineWidth = 3
      ctx.value.strokeRect(node.x - 2, node.y - 2, node.width + 4, node.height + 4)
    }
  }
}


//坐标转换函数
function screenToCanvas(clientX, clientY) {
  const rect = canvasRef.value.getBoundingClientRect()
  const screenX = clientX - rect.left
  const screenY = clientY - rect.top
  return {
    canvasX: (screenX - offsetX.value) / scale.value,
    canvasY: (screenY - offsetY.value) / scale.value,
  }
}


//查找节点函数
function findNodeAt(canvasX, canvasY) {
  for (const id in nodes.value) {
    const node = nodes.value[id]
    if (canvasX >= node.x && canvasX <= node.x + node.width &&
        canvasY >= node.y && canvasY <= node.y + node.height) {
      return node
    }
  }
  return null
}

//获取节点及其所有子孙节点
function getNodeAndDescendants(nodeId) {
  const result = [nodeId]
  const node = nodes.value[nodeId]
  if (node && node.children) {
    for (const childId of node.children) {
      result.push(...getNodeAndDescendants(childId))
    }
  }
  return result
}

//根据文本计算节点尺寸
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

//更新节点尺寸
function updateNodeSize(node) {
  const size = calculateNodeSize(node.text)
  node.width = size.width
  node.height = size.height
}

//获取所有可见的节点ID（未折叠的节点）
function getVisibleNodeIds() {
  const visibleIds = new Set()

  function traverse(nodeId) {
    const node = nodes.value[nodeId]
    if (!node) return

    visibleIds.add(nodeId)

    // 如果节点未折叠，递归遍历子节点
    if (!node.collapsed && node.children) {
      for (const childId of node.children) {
        traverse(childId)
      }
    }
  }

  // 从所有根节点开始遍历
  for (const rootId of rootIds.value) {
    traverse(rootId)
  }

  return Array.from(visibleIds)
}

//切换节点折叠状态
function toggleNodeCollapse(nodeId) {
  const node = nodes.value[nodeId]
  if (node && node.children && node.children.length > 0) {
    node.collapsed = !node.collapsed
    scheduleDraw()
  }
}

//切换布局方向
function toggleLayoutDirection() {
  layoutDirection.value = layoutDirection.value === 'left-right' ? 'top-bottom' : 'left-right'
  // 重新布局所有节点
  relayoutNodes()
  scheduleDraw()
}

//重新布局所有节点
function relayoutNodes() {
  if (layoutDirection.value === 'left-right') {
    // 左→右布局：子节点在父节点右侧
    for (const id in nodes.value) {
      const node = nodes.value[id]
      if (node.parentId) {
        const parent = nodes.value[node.parentId]
        if (parent) {
          node.x = parent.x + parent.width + 50
          node.y = parent.y
        }
      }
    }
  } else {
    // 上→下布局：子节点在父节点下方
    for (const id in nodes.value) {
      const node = nodes.value[id]
      if (node.parentId) {
        const parent = nodes.value[node.parentId]
        if (parent) {
          node.x = parent.x
          node.y = parent.y + parent.height + 50
        }
      }
    }
  }
}

//查找连接线
function findConnectionAt(canvasX, canvasY) {
  const visibleNodeIds = getVisibleNodeIds()
  const threshold = 10 // 点击容差

  for (const id in nodes.value) {
    const node = nodes.value[id]
    if (node.parentId && nodes.value[node.parentId] && visibleNodeIds.includes(id)) {
      const parent = nodes.value[node.parentId]
      let startX, startY, endX, endY

      if (layoutDirection.value === 'left-right') {
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

      // 计算点到线段的距离
      const distance = pointToLineDistance(canvasX, canvasY, startX, startY, endX, endY)
      if (distance < threshold) {
        return { parentId: parent.id, childId: node.id }
      }
    }
  }
  return null
}

//计算点到线段的距离
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

//删除连接线
function deleteConnection(parentId, childId) {
  const parent = nodes.value[parentId]
  const child = nodes.value[childId]

  if (parent && child) {
    // 从父节点的children中移除
    parent.children = parent.children.filter(id => id !== childId)
    // 将子节点变为根节点
    child.parentId = null
    rootIds.value.push(childId)

    selectedConnection.value = null
    saveState()
    scheduleDraw()
  }
}


//事件处理函数
//滚轮缩放（以鼠标落点为中心）
function onWheel(e) {
  e.preventDefault()//阻止页面默认行为
  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const canvasX = (mouseX - offsetX.value) / scale.value
  const canvasY = (mouseY - offsetY.value) / scale.value
  const delta = e.deltaY > 0 ? 0.9 : 1.1

  // 缩放限制
  const MIN_SCALE = 0.1
  const MAX_SCALE = 5.0
  scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value * delta))

  offsetX.value = mouseX - canvasX * scale.value
  offsetY.value = mouseY - canvasY * scale.value
  scheduleDraw()
}

//键盘事件
function handleKeyDown(e) {
  // 空格键：画布平移模式
  if (e.code === 'Space' && !isSpacePressed.value) {
    isSpacePressed.value = true
    e.preventDefault()
    containerRef.value.style.cursor = 'grab'
    return
  }

  // 如果正在编辑节点，不处理其他快捷键
  if (editingNodeId.value) {
    return
  }

  // 撤销/重做：Ctrl+Z / Ctrl+Y
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    if (e.shiftKey) {
      redo() // Ctrl+Shift+Z 或 Ctrl+Y
    } else {
      undo() // Ctrl+Z
    }
    e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
    redo() // Ctrl+Y
    e.preventDefault()
    return
  }

  // Delete/Backspace：删除选中节点或连接线
  if (e.code === 'Delete' || e.code === 'Backspace') {
    if (selectedConnection.value) {
      // 删除选中的连接线
      deleteConnection(selectedConnection.value.parentId, selectedConnection.value.childId)
      e.preventDefault()
      return
    } else if (selectedNodeId.value) {
      // 删除选中的节点
      deleteNode(selectedNodeId.value)
      e.preventDefault()
      return
    }
  }

  // Enter：添加子节点
  if (e.code === 'Enter' && selectedNodeId.value) {
    addChildNode(selectedNodeId.value)
    e.preventDefault()
    return
  }

  // Tab：添加同级节点
  if (e.code === 'Tab' && selectedNodeId.value) {
    e.preventDefault()
    const node = nodes.value[selectedNodeId.value]
    if (node && node.parentId) {
      addChildNode(node.parentId)
    }
    return
  }

  // 方向键：微调节点位置
  if (selectedNodeId.value && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    const node = nodes.value[selectedNodeId.value]
    if (node) {
      const step = 10
      switch (e.code) {
        case 'ArrowUp':
          node.y = Math.max(0, node.y - step)
          break
        case 'ArrowDown':
          node.y = Math.min(canvasHeight.value - node.height, node.y + step)
          break
        case 'ArrowLeft':
          node.x = Math.max(0, node.x - step)
          break
        case 'ArrowRight':
          node.x = Math.min(canvasWidth.value - node.width, node.x + step)
          break
      }
      scheduleDraw()
      e.preventDefault()
    }
    return
  }

  // L：切换布局方向
  if (e.code === 'KeyL') {
    toggleLayoutDirection()
    e.preventDefault()
    return
  }

  // +/-：缩放画布
  // 修复键盘快捷键：同时检测 Equal 和 Shift+Equal（+）
  if ((e.code === 'Equal' || e.code === 'NumpadAdd') || (e.code === 'Equal' && e.shiftKey)) {
    scale.value = Math.min(5.0, scale.value * 1.1)
    scheduleDraw()
    e.preventDefault()
    return
  }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
    scale.value = Math.max(0.1, scale.value * 0.9)
    scheduleDraw()
    e.preventDefault()
    return
  }
}
function handleKeyUp(e) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    containerRef.value.style.cursor = 'default'
  }
}

//鼠标按下
function onMouseDown(e) {
  //坐标转换
  const { canvasX, canvasY } = screenToCanvas(e.clientX, e.clientY)
  //画布平移
  if (isSpacePressed.value) {
    isPanning.value = true
    panStartX.value = e.clientX
    panStartY.value = e.clientY
    containerRef.value.style.cursor = 'grabbing'
    e.preventDefault()
    return
  }
  //选中节点
  const hitNode = findNodeAt(canvasX, canvasY)
  if (hitNode) {
    selectedNodeId.value = hitNode.id
    selectedConnection.value = null // 清除连接线选中状态
    isDraggingNode.value = true
    dragNodeId.value = hitNode.id
    dragOffsetX.value = canvasX - hitNode.x
    dragOffsetY.value = canvasY - hitNode.y
    hasNodeMoved.value = false // 重置移动标志

    // 获取所有需要拖拽的节点（包括子孙节点）
    dragNodeIds.value = getNodeAndDescendants(hitNode.id)

    // 记录所有节点的初始位置
    dragNodePositions.value = {}
    for (const nodeId of dragNodeIds.value) {
      const node = nodes.value[nodeId]
      dragNodePositions.value[nodeId] = { x: node.x, y: node.y }
    }

    e.preventDefault()
  } else {
    // 检查是否点击了连接线
    const hitConnection = findConnectionAt(canvasX, canvasY)
    if (hitConnection) {
      selectedConnection.value = hitConnection
      selectedNodeId.value = null // 清除节点选中状态
      e.preventDefault()
    } else {
      // 点击画布空白处，创建根节点
      selectedNodeId.value = null
      selectedConnection.value = null
      createRootNode(canvasX, canvasY)
    }
  }
}

//鼠标移动
function onMouseMove(e) {
  //平移模式
  if (isPanning.value) {
    const dx = e.clientX - panStartX.value
    const dy = e.clientY - panStartY.value
    offsetX.value += dx
    offsetY.value += dy
    panStartX.value = e.clientX
    panStartY.value = e.clientY
    scheduleDraw()
    e.preventDefault()
  }
  //拖拽模式
  else if (isDraggingNode.value) {
    const { canvasX, canvasY } = screenToCanvas(e.clientX, e.clientY)
    const rootNode = nodes.value[dragNodeId.value]
    if (rootNode) {
      // 计算根节点的新位置
      let newRootX = canvasX - dragOffsetX.value
      let newRootY = canvasY - dragOffsetY.value

      // 计算偏移量
      const deltaX = newRootX - dragNodePositions.value[dragNodeId.value].x
      const deltaY = newRootY - dragNodePositions.value[dragNodeId.value].y

      // 检查节点是否真的移动了
      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        hasNodeMoved.value = true
      }

      // 完善边界检查：确保所有子孙节点都在画布范围内
      let minX = 0, minY = 0, maxX = canvasWidth.value, maxY = canvasHeight.value

      for (const nodeId of dragNodeIds.value) {
        const node = nodes.value[nodeId]
        if (node) {
          const newX = dragNodePositions.value[nodeId].x + deltaX
          const newY = dragNodePositions.value[nodeId].y + deltaY
          minX = Math.max(minX, -newX)
          minY = Math.max(minY, -newY)
          maxX = Math.min(maxX, canvasWidth.value - newX - node.width)
          maxY = Math.min(maxY, canvasHeight.value - newY - node.height)
        }
      }

      // 调整偏移量以适应边界
      const adjustedDeltaX = deltaX + Math.max(0, minX) + Math.min(0, maxX)
      const adjustedDeltaY = deltaY + Math.max(0, minY) + Math.min(0, maxY)

      // 更新所有相关节点的位置
      for (const nodeId of dragNodeIds.value) {
        const node = nodes.value[nodeId]
        if (node) {
          node.x = dragNodePositions.value[nodeId].x + adjustedDeltaX
          node.y = dragNodePositions.value[nodeId].y + adjustedDeltaY
        }
      }

      scheduleDraw()
    }
    e.preventDefault()
  }
}

//鼠标松开
function onMouseUp(e) {
  if (isPanning.value) {
    isPanning.value = false
    containerRef.value.style.cursor = isSpacePressed.value ? 'grab' : 'default'
  }
  if (isDraggingNode.value) {
    // 如果节点真的移动了，保存状态到撤销栈
    if (hasNodeMoved.value) {
      saveState()
    }
    isDraggingNode.value = false
    dragNodeId.value = null
    dragNodeIds.value = []
    hasNodeMoved.value = false
    // 修复内存泄漏：直接重置对象而不是逐个删除
    dragNodePositions.value = {}
  }
}

//双击状态
function onDblClick(e) {
  const { canvasX, canvasY } = screenToCanvas(e.clientX, e.clientY)
  const hitNode = findNodeAt(canvasX, canvasY)
  if (hitNode) {
    // 检查是否点击了折叠指示器（节点右侧的小圆点）
    const indicatorX = hitNode.x + hitNode.width - 10
    const indicatorY = hitNode.y + hitNode.height / 2
    const distance = Math.sqrt(Math.pow(canvasX - indicatorX, 2) + Math.pow(canvasY - indicatorY, 2))

    if (hitNode.children && hitNode.children.length > 0 && distance <= 10) {
      // 点击了折叠指示器，切换折叠状态
      toggleNodeCollapse(hitNode.id)
    } else {
      // 编辑节点文本
      editingNodeId.value = hitNode.id
      editingText.value = hitNode.text
      // 修复编辑器定位：移除多余的 rect.left 和 rect.top，因为编辑器已相对于容器绝对定位
      const screenX = hitNode.x * scale.value + offsetX.value
      const screenY = hitNode.y * scale.value + offsetY.value
      editorPosition.x = screenX
      editorPosition.y = screenY
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  }
}

//编辑结束
function finishEdit() {
  if (editingNodeId.value) {
    const node = nodes.value[editingNodeId.value]
    if (node) {
      node.text = editingText.value
      updateNodeSize(node) // 更新节点尺寸
    }
    editingNodeId.value = null
    saveState() // 保存状态到撤销栈
    // 修复连线刷新问题：使用 scheduleDraw 而不是直接调用 draw
    scheduleDraw()
  }
}

//删除节点及其所有子孙节点
function deleteNode(nodeId) {
  const node = nodes.value[nodeId]
  if (!node) return

  // 获取所有需要删除的节点ID
  const nodesToDelete = getNodeAndDescendants(nodeId)

  // 从父节点的children中移除
  if (node.parentId) {
    const parent = nodes.value[node.parentId]
    if (parent) {
      parent.children = parent.children.filter(id => id !== nodeId)
    }
  } else {
    // 如果是根节点，从rootIds中移除
    rootIds.value = rootIds.value.filter(id => id !== nodeId)
  }

  // 删除所有节点
  for (const id of nodesToDelete) {
    delete nodes.value[id]
  }

  selectedNodeId.value = null
  saveState() // 保存状态到撤销栈
  scheduleDraw()
}

//添加子节点
function addChildNode(parentId) {
  const parent = nodes.value[parentId]
  if (!parent) return

  // 改进 ID 生成方式：使用自增 ID 而不是 Date.now()
  const newId = `node_${++nodeIdCounter}`
  let newNode

  if (layoutDirection.value === 'left-right') {
    // 左→右布局：子节点在父节点右侧
    newNode = {
      id: newId,
      text: '新节点',
      x: parent.x + parent.width + 50,
      y: parent.y,
      width: 100,
      height: 40,
      parentId: parentId,
      children: [],
      collapsed: false
    }
  } else {
    // 上→下布局：子节点在父节点下方
    newNode = {
      id: newId,
      text: '新节点',
      x: parent.x,
      y: parent.y + parent.height + 50,
      width: 100,
      height: 40,
      parentId: parentId,
      children: [],
      collapsed: false
    }
  }

  nodes.value[newId] = newNode
  parent.children.push(newId)

  updateNodeSize(newNode)
  selectedNodeId.value = newId
  saveState() // 保存状态到撤销栈
  scheduleDraw()
}

//创建根节点（点击画布空白处）
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
    collapsed: false
  }

  nodes.value[newId] = newNode
  rootIds.value.push(newId)

  updateNodeSize(newNode)
  selectedNodeId.value = newId
  saveState() // 保存状态到撤销栈
  scheduleDraw()
}

// ===== 暴露给前端B的API接口 =====

// 获取思维导图数据
function getMindMapData() {
  return {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    rootIds: JSON.parse(JSON.stringify(rootIds.value))
  }
}

// 加载思维导图数据
function loadMindMapData(data) {
  nodes.value = data.nodes
  rootIds.value = data.rootIds
  scheduleDraw()
}

// 导出为PNG
function exportAsPNG() {
  return canvasRef.value.toDataURL('image/png')
}

// 清空画布
function clearCanvas() {
  nodes.value = {}
  rootIds.value = []
  scheduleDraw()
}

// 获取当前布局方向
function getLayoutDirection() {
  return layoutDirection.value
}

// 设置布局方向
function setLayoutDirection(direction) {
  layoutDirection.value = direction
  relayoutNodes()
  scheduleDraw()
}
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