<template>
  <div id="app">
    <MindMapCanvas />
  </div>
</template>

<script setup>
import MindMapCanvas from './components/MindMapCanvas.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>