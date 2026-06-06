<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
}>(), {
  label: 'Estamos verificando conexiones'
});
</script>

<template>
  <div class="grid min-h-48 place-items-center">
    <div class="flex flex-col items-center gap-4" role="status" :aria-label="label">
      <div class="flex gap-2">
        <span class="size-3 animate-ping rounded-full bg-sky-600"></span>
        <span class="size-3 animate-ping rounded-full bg-sky-600 [animation-delay:0.2s]"></span>
        <span class="size-3 animate-ping rounded-full bg-sky-600 [animation-delay:0.4s]"></span>
      </div>
      <p class="text-sm font-medium text-slate-500">{{ label }}</p>
    </div>
  </div>
</template>
