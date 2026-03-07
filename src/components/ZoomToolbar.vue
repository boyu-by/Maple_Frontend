<template>
  <div class="zoom-toolbar">
    <!-- 缩小按钮 -->
    <button
      class="zoom-btn"
      @click="$emit('zoom-out')"
      :disabled="zoomLevel <= minZoom"
      title="缩小 (Ctrl+-)"
    >
      <span class="icon">−</span>
    </button>

    <!-- 缩放比例显示 -->
    <div class="zoom-display">
      <span class="zoom-value" :class="{ changing: isZoomChanging }">{{ Math.round(zoomLevel * 100) }}%</span>
    </div>

    <!-- 放大按钮 -->
    <button
      class="zoom-btn"
      @click="$emit('zoom-in')"
      :disabled="zoomLevel >= maxZoom"
      title="放大 (Ctrl++)"
    >
      <span class="icon">+</span>
    </button>

    <!-- 分隔线 -->
    <div class="zoom-divider"></div>

    <!-- 重置视图按钮 -->
    <button
      class="zoom-btn reset-btn"
      @click="$emit('reset-view')"
      title="重置视图"
    >
      <span class="icon">↺</span>
    </button>

    <!-- 适应屏幕按钮 -->
    <button
      class="zoom-btn fit-btn"
      @click="$emit('fit-to-screen')"
      title="适应屏幕"
    >
      <span class="icon">⊞</span>
    </button>

    <!-- 分隔线 -->
    <div class="zoom-divider"></div>

    <!-- 创建节点模式按钮 -->
    <button
      class="zoom-btn create-node-btn"
      @click="handleToggleCreateNodeMode"
      :class="{ active: isCreateNodeMode }"
      title="创建节点模式"
    >
      <span class="icon">+</span>
      <span class="btn-text">创建节点模式</span>
    </button>

    <!-- 创建版本按钮 -->
    <button
      class="zoom-btn version-btn"
      @click="$emit('create-version')"
      title="创建版本"
    >
      <span class="icon">↓</span>
    </button>

    <!-- 版本历史按钮 -->
    <button
      class="zoom-btn version-btn"
      @click="$emit('show-versions')"
      title="版本历史"
    >
      <span class="icon">≡</span>
    </button>
  </div>

  <!-- 固定状态窗口 -->
  <div class="status-panel" :class="{ active: isCreateNodeMode }">
    <div class="status-icon">{{ isCreateNodeMode ? '✓' : '○' }}</div>
    <div class="status-text">{{ isCreateNodeMode ? '创建节点模式' : '普通模式' }}</div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  zoomLevel: {
    type: Number,
    default: 1
  },
  minZoom: {
    type: Number,
    default: 0.1
  },
  maxZoom: {
    type: Number,
    default: 5
  },
  isCreateNodeMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['zoom-in', 'zoom-out', 'reset-view', 'fit-to-screen', 'create-version', 'show-versions', 'toggle-create-node-mode'])

const isZoomChanging = ref(false)

// 监听缩放级别变化，触发动画
watch(() => props.zoomLevel, () => {
  isZoomChanging.value = true
  setTimeout(() => {
    isZoomChanging.value = false
  }, 300)
})

// 处理创建节点模式切换
function handleToggleCreateNodeMode() {
  emit('toggle-create-node-mode')
}
</script>

<style scoped>
.zoom-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  border-radius: 16px;
  box-shadow:
    0 4px 20px rgba(230, 57, 70, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: relative;
  overflow: visible;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.zoom-toolbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
}

.zoom-toolbar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: -50%;
  width: 200%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.zoom-toolbar:hover::after {
  transform: translateX(100%);
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.zoom-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.zoom-btn:hover:not(:disabled)::before {
  opacity: 1;
}

.zoom-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 
    0 6px 20px rgba(0, 0, 0, 0.25),
    0 0 0 2px rgba(255, 255, 255, 0.1);
}

.zoom-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.08);
}

.zoom-btn .icon {
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  transition: transform 0.3s ease;
  user-select: none;
}

.zoom-btn:hover:not(:disabled) .icon {
  transform: scale(1.15) rotate(5deg);
}

/* 涟漪效果 */
.zoom-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
  opacity: 0;
}

.zoom-btn:active:not(:disabled)::after {
  width: 200%;
  height: 200%;
  opacity: 0;
  transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
}

/* 光晕动画 */
@keyframes glow {
  0%, 100% {
    box-shadow: 
      0 6px 20px rgba(0, 0, 0, 0.25),
      0 0 0 2px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow: 
      0 6px 20px rgba(0, 0, 0, 0.25),
      0 0 20px rgba(255, 255, 255, 0.3),
      0 0 0 2px rgba(255, 255, 255, 0.2);
  }
}

.zoom-btn:hover:not(:disabled) {
  animation: glow 2s ease-in-out infinite;
}

.zoom-display {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.zoom-display:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.02);
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.1),
    0 0 15px rgba(255, 255, 255, 0.2);
}

.zoom-value {
  font-size: 14px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  transition: all 0.3s ease;
}

/* 缩放值变化动画 */
.zoom-value {
  animation: none;
}

.zoom-value.changing {
  animation: valueChange 0.3s ease;
}

@keyframes valueChange {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.zoom-divider {
  width: 1px;
  height: 28px;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  margin: 0 4px;
}

.reset-btn:hover:not(:disabled),
.fit-btn:hover:not(:disabled),
.version-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 6px 20px rgba(230, 57, 70, 0.4);
}

/* 创建节点模式按钮 */
.create-node-btn {
  position: relative;
  width: auto;
  min-width: 40px;
  padding: 0 12px;
  gap: 6px;
}

.create-node-btn .btn-text {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.create-node-btn.active {
  background: rgba(255, 255, 255, 0.4);
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.5),
    0 6px 20px rgba(230, 57, 70, 0.5);
}

.create-node-btn.active::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 14px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.05);
  }
}

.create-node-btn.active .icon {
  transform: scale(1.2);
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
}

/* 动画效果 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.zoom-btn:active .icon {
  animation: pulse 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .zoom-toolbar {
    padding: 8px 12px;
    gap: 4px;
  }

  .zoom-btn {
    width: 36px;
    height: 36px;
  }

  .zoom-btn .icon {
    font-size: 24px;
  }

  .zoom-display {
    min-width: 60px;
    height: 32px;
    padding: 0 10px;
  }

  .zoom-value {
    font-size: 13px;
  }

  .zoom-divider {
    height: 24px;
  }
}

@media (max-width: 480px) {
  .zoom-toolbar {
    padding: 6px 10px;
    gap: 3px;
  }

  .zoom-btn {
    width: 32px;
    height: 32px;
  }

  .zoom-btn .icon {
    font-size: 20px;
  }

  .zoom-display {
    min-width: 54px;
    height: 28px;
    padding: 0 8px;
  }

  .zoom-value {
    font-size: 12px;
  }

  .zoom-divider {
    height: 20px;
  }
}

/* 固定状态窗口 */
.status-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.status-panel.active {
  background: linear-gradient(135deg, #42b883 0%, #35a372 100%);
  box-shadow: 0 4px 20px rgba(66, 184, 131, 0.4);
}

.status-icon {
  font-size: 20px;
  font-weight: bold;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
