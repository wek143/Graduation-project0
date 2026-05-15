<script setup>
import { useToast } from '@/stores/toast'
const { toasts } = useToast()
</script>

<template>
  <div class="toast-viewport" aria-live="polite" aria-atomic="true">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
      <strong class="toast-title">{{ t.title }}</strong>
      <span class="toast-body">{{ t.message }}</span>
    </div>
  </div>
</template>
