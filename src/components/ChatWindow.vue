<template>
  <div class="chat-window" :class="{ 'collapsed': isCollapsed }">
    <!-- 折叠按钮 -->
    <button
      class="toggle-btn"
      @click="toggleCollapse"
      :title="isCollapsed ? '展开聊天窗口' : '折叠聊天窗口'"
    >
      <span class="toggle-icon">🍁</span>
    </button>

    <!-- 聊天窗口内容 -->
    <div class="chat-content" v-show="!isCollapsed">
      <!-- 头部 -->
      <div class="chat-header">
        <h3>AI 助手</h3>
        <span class="status-dot" :class="{ 'online': isOnline }"></span>
      </div>

      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesContainer">
        <div 
          v-for="(message, index) in messages" 
          :key="index"
          class="message"
          :class="message.role"
        >
          <div class="message-avatar">
            <span v-if="message.role === 'user'" class="avatar-icon">👤</span>
            <span v-else class="avatar-icon">🍁</span>
          </div>
          <div class="message-content">
            <div class="message-text" v-html="parseMarkdown(message.content)"></div>
            <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          </div>
        </div>

        <!-- 加载动画 -->
        <div v-if="isLoading" class="message assistant">
          <div class="message-avatar">
            <span class="avatar-icon">🍁</span>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <!-- 空状态提示 -->
        <div v-if="messages.length === 0 && !isLoading" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>开始与 AI 助手对话吧！</p>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <textarea
          v-model="inputMessage"
          @keydown.enter.prevent="handleEnter"
          placeholder="输入消息..."
          rows="1"
          ref="inputTextarea"
        ></textarea>
        <button 
          class="send-btn" 
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isLoading"
        >
          <svg class="send-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2L11 13"></path>
            <path d="M22 2L15 22L11 13L2 9L22 2"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'

// 简单的Markdown解析函数
function parseMarkdown(text) {
  if (!text) return ''
  
  // 替换换行符为<br>
  text = text.replace(/\n/g, '<br>')
  
  // 替换粗体
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // 替换列表
  text = text.replace(/^- (.*?)$/gm, '<li>$1</li>')
  text = text.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>')
  
  return text
}

// 响应式数据
const isCollapsed = ref(false)
const isOnline = ref(true)
const isLoading = ref(false)
const inputMessage = ref('')
const messages = ref([
  {
    role: 'assistant',
    content: '你好！我是 AI 助手，有什么可以帮助你的吗？',
    timestamp: new Date()
  }
])

// 引用
const messagesContainer = ref(null)
const inputTextarea = ref(null)

// 切换折叠状态
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

// 处理回车键
function handleEnter(event) {
  if (event.shiftKey) {
    // Shift + Enter 换行
    return
  }
  sendMessage()
}

// 发送消息
async function sendMessage() {
  const content = inputMessage.value.trim()
  if (!content || isLoading.value) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content,
    timestamp: new Date()
  })

  // 清空输入框
  inputMessage.value = ''
  
  // 自动调整输入框高度
  nextTick(() => {
    if (inputTextarea.value) {
      inputTextarea.value.style.height = 'auto'
    }
  })

  // 滚动到底部
  scrollToBottom()

  // 设置加载状态
  isLoading.value = true

  try {
    // 调用后端接口（预留接口）
    const response = await callBackendAPI(content)
    
    // 添加 AI 回复
    messages.value.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('调用 AI 接口失败:', error)
    messages.value.push({
      role: 'assistant',
      content: '抱歉，发生了错误，请稍后再试。',
      timestamp: new Date()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 调用后端 API
async function callBackendAPI(message) {
  try {
    const response = await fetch('/api/agent/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `topic=${encodeURIComponent(message)}`,
    })
    
    if (!response.ok) {
      throw new Error('API 调用失败')
    }
    
    // 尝试解析响应，处理不同的响应格式
    const text = await response.text()
    try {
      // 尝试解析为JSON
      const data = JSON.parse(text)
      // 检查是否是错误响应
      if (data.error) {
        throw new Error(data.error)
      }
      return data
    } catch (jsonError) {
      // 如果不是JSON，直接返回文本
      return text
    }
  } catch (error) {
    console.error('调用 AI 接口失败:', error)
    throw error
  }
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// 监听输入框内容变化，自动调整高度
watch(inputMessage, () => {
  nextTick(() => {
    if (inputTextarea.value) {
      inputTextarea.value.style.height = 'auto'
      inputTextarea.value.style.height = Math.min(inputTextarea.value.scrollHeight, 120) + 'px'
    }
  })
})

// 暴露方法给父组件
defineExpose({
  toggleCollapse,
  addMessage: (role, content) => {
    messages.value.push({ role, content, timestamp: new Date() })
    scrollToBottom()
  }
})
</script>

<style scoped>
.chat-window {
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 380px;
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  box-shadow: 2px 0 20px rgba(230, 57, 70, 0.3);
  z-index: 1000;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-window::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
}

.chat-window::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.chat-window.collapsed {
  transform: translateX(-340px);
}

.toggle-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  overflow: hidden;
  z-index: 1001;
}

.toggle-btn::before {
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

.toggle-btn:hover::before {
  opacity: 1;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toggle-btn:active {
  transform: scale(0.95);
}

.chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 20px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.chat-header h3 {
  margin: 0;
  color: white;
  font-size: 18px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ff4757;
  box-shadow: 0 0 10px rgba(255, 71, 87, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.online {
  background-color: #2ed573;
  box-shadow: 0 0 10px rgba(46, 213, 115, 0.5);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.messages-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.message {
  display: flex;
  gap: 12px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.3);
}

.message.assistant .message-avatar {
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.3);
}

.toggle-icon {
  font-size: 16px;
  line-height: 1;
}

.avatar-icon {
  font-size: 20px;
  line-height: 1;
}

.message-content {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-text {
  padding: 12px 16px;
  border-radius: 16px;
  line-height: 1.5;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.user .message-text {
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  color: white;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.3);
}

.message.assistant .message-text {
  background: rgba(255, 255, 255, 0.98);
  color: #333;
  border-bottom-left-radius: 4px;
  text-align: left;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.message-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.message.user .message-time {
  text-align: right;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  gap: 12px;
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.input-area {
  padding: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  gap: 10px;
  align-items: flex-end;
  position: relative;
  z-index: 1;
}

.input-area textarea {
  flex: 1;
  background: rgba(255, 255, 255, 0.98);
  border: 2px solid transparent;
  border-radius: 20px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 44px;
  max-height: 120px;
  font-family: inherit;
  transition: all 0.3s ease;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.input-area textarea:focus {
  border-color: rgba(230, 57, 70, 0.3);
  box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.1), 0 2px 8px rgba(0, 0, 0, 0.08);
}

.input-area textarea::placeholder {
  color: #999;
}

.send-btn {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #E63946 0%, #FF6B35 50%, #F4A261 100%);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.3);
  position: relative;
  overflow: hidden;
}

.send-btn::before {
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

.send-btn:hover::before {
  opacity: 1;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 6px 20px rgba(230, 57, 70, 0.5);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95) rotate(-5deg);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.send-btn .send-icon {
  transition: transform 0.3s ease;
  position: relative;
  z-index: 1;
}

.send-btn:hover:not(:disabled) .send-icon {
  transform: translateX(2px);
}
</style>
