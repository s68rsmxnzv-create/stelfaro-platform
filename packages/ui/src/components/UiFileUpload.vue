<script setup lang="ts">
withDefaults(defineProps<{
  id: string;
  label?: string;
  selectedLabel?: string | null;
  accept?: string;
  multiple?: boolean;
}>(), {
  label: 'Subir archivo',
  selectedLabel: null,
  accept: undefined,
  multiple: false
});

const emit = defineEmits<{
  change: [event: Event];
}>();
</script>

<template>
  <label :for="id" class="block cursor-pointer rounded-md border border-slate-300 bg-white p-4 text-slate-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 sm:p-5">
    <div class="flex items-center justify-center gap-4">
      <span class="min-w-0 truncate text-sm font-semibold">{{ selectedLabel || label }}</span>

      <svg class="h-6 w-6 shrink-0 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 0 0 4.5 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25h-.75m0-3-3-3m0 0-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-7.5a2.25 2.25 0 0 1-2.25-2.25v-.75" />
      </svg>
    </div>

    <input
      :id="id"
      class="sr-only"
      type="file"
      :accept="accept"
      :multiple="multiple"
      @change="emit('change', $event)"
    >
  </label>
</template>
