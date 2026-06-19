<script setup lang="ts">
import { computed, ref } from 'vue';

defineOptions({
  inheritAttrs: false
});

defineProps<{
  label: string;
  modelValue: string | null | undefined;
  placeholder?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();

const visible = ref(false);
const inputType = computed(() => visible.value ? 'text' : 'password');
</script>

<template>
  <label class="block">
    <span class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-slate-700">{{ label }}</span>
      <slot name="action" />
    </span>

    <span class="relative mt-1 flex items-center">
      <button
        type="button"
        class="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-100"
        :aria-label="visible ? 'Ocultar password' : 'Mostrar password'"
        @click="visible = !visible"
      >
        <svg v-if="visible" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
          <path d="M22.68 12.55a1.76 1.76 0 0 0 0-1.11 11.96 11.96 0 0 0-4.24-5.7A10.45 10.45 0 0 0 12 3.75c-1.58 0-3.09.34-4.44.96l2.03 2.03A5.25 5.25 0 0 1 17.26 14.4l3.12 3.12a11.97 11.97 0 0 0 2.3-4.97Z" />
          <path d="M3.62 5.16a11.98 11.98 0 0 0-2.3 6.28 1.76 1.76 0 0 0 0 1.11C2.81 17.02 7.03 20.25 12 20.25c1.58 0 3.09-.34 4.44-.96l-2.05-2.05A5.25 5.25 0 0 1 6.76 9.61L3.62 5.16Z" />
        </svg>
        <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path fill-rule="evenodd" d="M1.32 11.45C2.81 6.98 7.03 3.75 12 3.75c4.97 0 9.19 3.22 10.68 7.69.12.36.12.75 0 1.11-1.49 4.47-5.71 7.7-10.68 7.7-4.97 0-9.19-3.22-10.68-7.69a1.76 1.76 0 0 1 0-1.11ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
        </svg>
      </button>

      <input
        v-bind="$attrs"
        :type="inputType"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="w-full rounded-md border border-blue-100 bg-white/90 py-2 pl-3 pr-11 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
    </span>
  </label>
</template>
