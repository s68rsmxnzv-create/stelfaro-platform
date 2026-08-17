<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  iconOnly?: boolean;
}>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  iconOnly: false
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-lg text-sm font-semibold tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:!bg-surface-muted disabled:!text-soft disabled:!shadow-none"
    :class="{
      'h-8 px-3': size === 'sm' && !iconOnly,
      'h-8 w-8 p-0': size === 'sm' && iconOnly,
      'h-12 px-6': size === 'md' && !iconOnly,
      'h-12 w-12 p-0': size === 'md' && iconOnly,
      'bg-primary text-primary-contrast hover:bg-primary-hover focus:outline-none focus:ring focus:ring-primary': variant === 'primary',
      'bg-success text-primary-contrast hover:brightness-95 focus:outline-none focus:ring focus:ring-success': variant === 'success',
      'bg-danger-soft text-danger hover:bg-danger hover:text-primary-contrast focus:outline-none focus:ring focus:ring-danger': variant === 'danger',
      'bg-surface-muted text-text hover:bg-surface-strong focus:outline-none focus:ring focus:ring-line-strong': variant === 'secondary',
      'text-muted hover:bg-surface-muted hover:text-text focus:outline-none focus:ring focus:ring-line': variant === 'ghost'
    }"
  >
    <slot />
  </button>
</template>
