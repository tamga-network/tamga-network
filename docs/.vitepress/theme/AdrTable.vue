<script setup lang="ts">
import { data as adrs } from "./adr.data";
import { statusLabel } from "./status";
</script>

<template>
  <div class="adr-table">
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Karar</th>
          <th>Alan</th>
          <th>Tarih</th>
          <th>Durum</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in adrs" :key="a.id">
          <td class="mono">{{ a.id.replace("ADR-", "") }}</td>
          <td>
            <a :href="a.url">{{ a.title.split(" — ")[0] }}</a>
          </td>
          <td>{{ a.domain }}</td>
          <td class="mono">{{ a.created }}</td>
          <td>
            <span :class="['doc-status', statusLabel(a.status, 'adr').tone]">{{ statusLabel(a.status, "adr").text }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.adr-table {
  overflow-x: auto;
}
.adr-table table {
  display: table;
  width: 100%;
  font-size: 14px;
}
.adr-table td {
  vertical-align: top;
}
.mono {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: nowrap;
}
</style>
