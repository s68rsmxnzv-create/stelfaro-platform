<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

defineProps<{
  label: string;
  modelValue: string | null | undefined;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function formatPhone(value: string): string {
  const digits = value.replace(/\D+/g, '').slice(0, 8);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

function updateValue(event: Event): void {
  const input = event.target as HTMLInputElement;
  const formatted = formatPhone(input.value);
  input.value = formatted;
  emit('update:modelValue', formatted);
}
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-slate-700">{{ label }}</span>

    <span class="relative mt-1 flex items-center">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a1.125 1.125 0 0 1-1.21.38 12.035 12.035 0 0 1-7.143-7.143 1.125 1.125 0 0 1 .38-1.21l1.293-.97a1.125 1.125 0 0 0 .417-1.173L6.963 3.102A1.125 1.125 0 0 0 5.872 2.25H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
      </span>

      <input
        v-bind="$attrs"
        type="tel"
        inputmode="numeric"
        maxlength="9"
        :value="modelValue ?? ''"
        :placeholder="placeholder ?? '0000-0000'"
        class="w-full rounded-md border border-blue-100 bg-white/90 py-2 pl-10 pr-3 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500"
        @input="updateValue"
      >
    </span>
  </label>
</template>
