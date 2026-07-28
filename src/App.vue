<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
:root {
  --bg: #1a1a2e; --surface: #16213e; --card: #0f3460; --border: #2a2a4a;
  --accent: #e94560; --text: #e2e2e2; --muted: #666; --hover: #1a2745;
  --green: rgba(78,203,113,0.15); --red: rgba(233,69,96,0.15); --grey: rgba(138,138,154,0.15);
}

body { margin: 0; background: var(--bg); color: var(--text); font-family: "Microsoft YaHei", sans-serif; }

/* Element UI 深色覆盖 */
.el-table, .el-table th, .el-table tr, .el-table td,
.el-input__inner, .el-select-dropdown, .el-scrollbar { background: var(--surface) !important; color: var(--text) !important; border-color: var(--border) !important; }
.el-input__inner:focus { border-color: var(--accent) !important; }
.el-table--enable-row-hover .el-table__body tr:hover > td,
.el-select-dropdown__item.hover, .el-select-dropdown__item:hover { background: var(--hover) !important; }
.el-table__empty-text, .el-select-dropdown__empty { color: var(--muted) !important; }
.el-dialog { background: #02091e !important; }
.el-dialog__title, .el-select-dropdown__item { color: var(--text) !important; }
.el-select-dropdown__item.selected { color: var(--accent) !important; }
.el-popper[x-placement^=bottom] .popper__arrow { border-bottom-color: var(--border) !important; }
.el-popper[x-placement^=bottom] .popper__arrow::after { border-bottom-color: var(--surface) !important; }

/* 标签 */
.el-tag--success { background: var(--green) !important; color: #4ecb71 !important; }
.el-tag--danger { background: var(--red) !important; color: var(--accent) !important; }
.el-tag--info { background: var(--grey) !important; color: #888 !important; }

/* 按钮 */
.el-button--default { background: var(--card) !important; color: var(--text) !important; border-color: var(--border) !important; }
.el-button--default:hover { color: var(--accent) !important; border-color: var(--accent) !important; }
.el-button--danger.is-plain, .el-button--mini { background: transparent !important; color: var(--accent) !important; border-color: var(--accent) !important; }
.el-button--danger.is-plain:hover, .el-button--danger, .el-button--mini:hover { background: var(--accent) !important; color: #fff !important; }
</style>
