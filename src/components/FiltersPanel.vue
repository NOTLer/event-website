<template>
  <div class="panel">
    <div class="row">
      <div class="spacer"></div>
      <button class="reset" type="button" @click="$emit('reset')">Сбросить</button>
    </div>

    <section class="card">
      <div class="h">Поиск по названию</div>
      <input
        class="input"
        type="text"
        :value="titleQuery"
        placeholder="Например: Концерт"
        @input="$emit('update:titleQuery', $event.target.value)"
      />
    </section>

    <section class="card">
      <div class="h">Категории</div>

      <div class="tags">
        <button class="tag" :class="{ active: selectedCategoryNames.length === 0 }" type="button" @click="setAll()">
          Все
        </button>

        <button
          v-for="c in categories"
          :key="c.id"
          class="tag"
          :class="{ active: selectedCategoryNames.includes(c.name) }"
          type="button"
          @click="toggleCategory(c.name)"
        >
          {{ c.name }}
        </button>
      </div>
    </section>

    <section class="card">
      <div class="h">Онлайн</div>
      <label class="toggle">
        <input type="checkbox" :checked="onlineOnly" @change="$emit('update:onlineOnly', $event.target.checked)" />
        <span class="ui"></span>
        <span class="txt">Только онлайн</span>
      </label>
      <div class="sub">Показывает только мероприятия, где <b>is_online=true</b>.</div>
    </section>

    <section class="card">
      <div class="h">Цена</div>
      <div class="chips">
        <button class="chip" :class="{ active: priceMode === 'all' }" type="button" @click="setPrice('all')">
          Любая
        </button>
        <button class="chip" :class="{ active: priceMode === 'free' }" type="button" @click="setPrice('free')">
          Бесплатно
        </button>
        <button class="chip" :class="{ active: priceMode === 'custom' }" type="button" @click="setPrice('custom')">
          Свой диапазон
        </button>
      </div>

      <div class="chips">
        <button class="chip" :class="{ active: priceMode === '100_1000' }" type="button" @click="setPrice('100_1000')">
          100–1000
        </button>
        <button class="chip" :class="{ active: priceMode === '1000_3000' }" type="button" @click="setPrice('1000_3000')">
          1000–3000
        </button>
        <button
          class="chip"
          :class="{ active: priceMode === '3000_10000' }"
          type="button"
          @click="setPrice('3000_10000')"
        >
          3000–10000
        </button>
        <button class="chip" :class="{ active: priceMode === 'gt_10000' }" type="button" @click="setPrice('gt_10000')">
          &gt; 10000
        </button>
      </div>

      <div v-if="priceMode === 'custom'" class="range">
        <input class="input" type="number" inputmode="numeric" placeholder="От" :value="customPriceMin" @input="$emit('update:customPriceMin', $event.target.value)" />
        <input class="input" type="number" inputmode="numeric" placeholder="До" :value="customPriceMax" @input="$emit('update:customPriceMax', $event.target.value)" />
      </div>

      <div class="sub">Если <b>is_free=true</b> или price=0 — это “Бесплатно”.</div>
    </section>

    <section class="card">
      <div class="h">Дата</div>

      <div class="chips">
        <button class="chip" :class="{ active: dateMode === 'all' }" type="button" @click="setDate('all')">Все время</button>
        <button class="chip" :class="{ active: dateMode === 'today' }" type="button" @click="setDate('today')">Сегодня</button>
        <button class="chip" :class="{ active: dateMode === 'next7' }" type="button" @click="setDate('next7')">7 дней</button>
      </div>

      <div class="chips">
        <button class="chip" :class="{ active: dateMode === 'on' }" type="button" @click="setDate('on')">Определённая</button>
        <button class="chip" :class="{ active: dateMode === 'range' }" type="button" @click="setDate('range')">Диапазон</button>
        <button class="chip" :class="{ active: dateMode === 'after' }" type="button" @click="setDate('after')">После</button>
        <button class="chip" :class="{ active: dateMode === 'before' }" type="button" @click="setDate('before')">До</button>
      </div>

      <div v-if="dateMode === 'on'" class="range">
        <input class="input" type="date" :value="dateOn" @input="$emit('update:dateOn', $event.target.value)" />
      </div>

      <div v-if="dateMode === 'range'" class="range">
        <input class="input" type="date" :value="dateFrom" @input="$emit('update:dateFrom', $event.target.value)" />
        <input class="input" type="date" :value="dateTo" @input="$emit('update:dateTo', $event.target.value)" />
      </div>

      <div v-if="dateMode === 'after' || dateMode === 'before'" class="range">
        <input class="input" type="date" :value="datePivot" @input="$emit('update:datePivot', $event.target.value)" />
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'FiltersPanel',
  emits: [
    'reset',
    'update:titleQuery',
    'update:selectedCategoryNames',
    'update:onlineOnly',
    'update:priceMode',
    'update:customPriceMin',
    'update:customPriceMax',
    'update:dateMode',
    'update:dateOn',
    'update:dateFrom',
    'update:dateTo',
    'update:datePivot'
  ],
  props: {
    categories: { type: Array, default: () => [] },
    titleQuery: { type: String, default: '' },
    selectedCategoryNames: { type: Array, default: () => [] },
    onlineOnly: { type: Boolean, default: false },
    priceMode: { type: String, default: 'all' },
    customPriceMin: { type: String, default: '' },
    customPriceMax: { type: String, default: '' },
    dateMode: { type: String, default: 'all' },
    dateOn: { type: String, default: '' },
    dateFrom: { type: String, default: '' },
    dateTo: { type: String, default: '' },
    datePivot: { type: String, default: '' }
  },
  methods: {
    setAll() {
      this.$emit('update:selectedCategoryNames', [])
    },
    toggleCategory(name) {
      const n = String(name || '').trim()
      if (!n) return
      const set = new Set(this.selectedCategoryNames)
      if (set.has(n)) set.delete(n)
      else set.add(n)
      this.$emit('update:selectedCategoryNames', Array.from(set))
    },
    setPrice(mode) {
      this.$emit('update:priceMode', mode)
    },
    setDate(mode) {
      this.$emit('update:dateMode', mode)
    }
  }
}
</script>

<style scoped>
.panel { display: grid; gap: 12px; }

.row { display: flex; align-items: center; }
.spacer { flex: 1; }
.reset {
  border: 1px solid #efefef;
  background: #fafafa;
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
}
.reset:hover { background: #f0f0f0; }

.card {
  background: #fff;
  border: 1px solid #efefef;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.03);
}
.h { font-weight: 900; margin-bottom: 10px; }

.tags { display: flex; flex-wrap: wrap; gap: 8px; }
.tag {
  border: 1px solid #efefef;
  background: #fff;
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
}
.tag.active { background: #8a75e3; border-color: #8a75e3; color: #fff; }

.toggle { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
.toggle input { display: none; }
.ui {
  width: 44px; height: 26px; border-radius: 999px;
  border: 1px solid #e9e9e9; background: #f3f3f3; position: relative;
  transition: background 180ms ease, border-color 180ms ease;
}
.ui::after {
  content: ''; width: 22px; height: 22px; border-radius: 999px;
  background: #fff; position: absolute; top: 1px; left: 1px;
  box-shadow: 0 2px 10px rgba(0,0,0,.08);
  transition: transform 180ms ease;
}
.toggle input:checked + .ui { background: rgba(138,117,227,.85); border-color: rgba(138,117,227,.55); }
.toggle input:checked + .ui::after { transform: translateX(18px); }
.txt { font-weight: 900; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.chip {
  border: 1px solid #efefef;
  background: #fff;
  border-radius: 999px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 900;
  font-size: 12px;
}
.chip.active { background: rgba(138,117,227,.12); border-color: rgba(138,117,227,.35); }

.range { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0 6px; }
.input {
  border: 1px solid #efefef;
  border-radius: 12px;
  padding: 10px;
  outline: none;
}
.input:focus { border-color: rgba(138,117,227,.55); box-shadow: 0 0 0 3px rgba(138,117,227,.12); }

.sub { font-size: 12px; opacity: .7; margin-top: 6px; line-height: 1.2; }
</style>
