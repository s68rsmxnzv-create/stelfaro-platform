<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  headline: string;
  suffix?: string;
  description?: string;
  featured?: boolean;
  current?: boolean;
  badgeLabel?: string;
}>(), {
  suffix: '',
  description: '',
  featured: false,
  current: false,
  badgeLabel: ''
});
</script>

<template>
  <article
    class="relative flex min-h-[30rem] w-full flex-col rounded-md border bg-white p-8 text-center shadow-sm shadow-blue-950/5 dark:bg-surface-raised dark:text-text dark:shadow-none"
    :class="featured ? 'border-sky-300 ring-2 ring-sky-100 dark:border-primary dark:ring-primary-soft/40' : 'border-slate-200 dark:border-line'"
  >
    <span
      v-if="current || featured"
      class="absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-bold uppercase"
      :class="current ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary'"
    >
      {{ current ? 'Actual' : (badgeLabel || 'Recomendado') }}
    </span>

    <div>
      <span class="inline-flex min-h-7 items-center justify-center rounded-md bg-slate-50 px-3 text-sm font-bold uppercase tracking-wide text-sky-600 dark:bg-surface-muted dark:text-primary">
        {{ title }}
      </span>
    </div>

    <div class="mt-10">
      <span class="text-4xl font-black tracking-normal text-slate-950 dark:text-text">{{ headline }}</span>
      <span v-if="suffix" class="ml-2 text-base font-semibold text-slate-500 dark:text-muted">{{ suffix }}</span>
    </div>

    <div v-if="$slots.badges" class="mt-4 flex flex-wrap items-center justify-center gap-2">
      <slot name="badges" />
    </div>

    <p v-if="description" class="mt-8 text-sm leading-6 text-slate-600 dark:text-muted">{{ description }}</p>

    <ul v-if="$slots.features" class="mt-8 flex-1 space-y-4 text-left text-sm leading-6 text-slate-600 dark:text-muted">
      <slot name="features" />
    </ul>

    <div v-if="$slots.actions" class="mt-10">
      <slot name="actions" />
    </div>
  </article>
</template>
