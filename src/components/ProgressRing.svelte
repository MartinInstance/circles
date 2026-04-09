<script>
  export let innerProgress = 0    // 0–1  wait countdown ring
  export let outerProgress = 0    // 0–1  meditation timer ring
  export let size         = 220
  export let strokeWidth  = 2
  export let ringGap      = 10    // px gap between outer and inner ring (at SVG scale)
  export let innerColor   = 'rgba(255,255,255,0.8)'
  export let outerColor   = 'rgba(255,255,255,0.4)'
  export let trackColor   = 'rgba(255,255,255,0.05)'

  $: cx = size / 2
  $: cy = size / 2

  $: rOuter = size / 2 - strokeWidth / 2 - 1
  $: rInner = rOuter - strokeWidth - ringGap

  $: circOuter = 2 * Math.PI * rOuter
  $: circInner = 2 * Math.PI * rInner

  $: offOuter = circOuter * (1 - Math.min(1, Math.max(0, outerProgress)))
  $: offInner = circInner * (1 - Math.min(1, Math.max(0, innerProgress)))
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  style="overflow: visible; display: block;"
>
  <!-- Outer ring: meditation timer -->
  <circle {cx} {cy} r={rOuter} fill="none" stroke={trackColor} stroke-width={strokeWidth}/>
  <circle {cx} {cy} r={rOuter} fill="none"
    stroke={outerColor} stroke-width={strokeWidth}
    stroke-dasharray={circOuter} stroke-dashoffset={offOuter}
    stroke-linecap="round"
    transform="rotate(-90 {cx} {cy})"
    style="transition: stroke-dashoffset 1s linear"
  />

  <!-- Inner ring: wait countdown -->
  <circle {cx} {cy} r={rInner} fill="none" stroke={trackColor} stroke-width={strokeWidth}/>
  <circle {cx} {cy} r={rInner} fill="none"
    stroke={innerColor} stroke-width={strokeWidth}
    stroke-dasharray={circInner} stroke-dashoffset={offInner}
    stroke-linecap="round"
    transform="rotate(-90 {cx} {cy})"
    style="transition: stroke-dashoffset 1s linear"
  />
</svg>
