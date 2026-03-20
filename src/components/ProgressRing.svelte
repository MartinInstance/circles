<script>
  export let progress    = 0    // 0–1
  export let size        = 220
  export let strokeWidth = 2
  export let color       = 'rgba(255,255,255,0.8)'
  export let trackColor  = 'rgba(255,255,255,0.05)'

  $: r             = (size - strokeWidth) / 2
  $: circumference = 2 * Math.PI * r
  $: dashOffset    = circumference * (1 - Math.min(1, Math.max(0, progress)))
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  style="transform: rotate(-90deg); overflow: visible; display: block;"
>
  <circle
    cx={size / 2} cy={size / 2} r={r}
    fill="none" stroke={trackColor} stroke-width={strokeWidth}
  />
  <circle
    cx={size / 2} cy={size / 2} r={r}
    fill="none" stroke={color} stroke-width={strokeWidth}
    stroke-dasharray={circumference}
    stroke-dashoffset={dashOffset}
    stroke-linecap="round"
  />
</svg>
