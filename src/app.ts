import "./style.css";
import { buildBaseVariant, runSimulation } from "./simulation";
import type {
  AdvancedInputs,
  AppState,
  Intervention,
  Labels,
  SimulationSeries,
  VariantScenario,
  VirusPreset
} from "./types";

const STORAGE_KEYS = {
  variants: "sir-model-diff-web:variants",
  interventions: "sir-model-diff-web:interventions"
};

const parameterFieldDefs = [
  { key: "beta", labelKey: "infection_rate_label", step: "0.01" },
  { key: "gamma", labelKey: "recovery_rate_label", step: "0.01" },
  { key: "mu", labelKey: "mortality_rate_label", step: "0.01" },
  { key: "incubation_period", labelKey: "incubation_period_label", step: "1" },
  { key: "xi", labelKey: "vax_rate_label", step: "0.01" },
  { key: "xi_r_multiplier", labelKey: "rec_vax_multiplier_label", step: "0.01" },
  { key: "epsilon_v", labelKey: "vax_efficacy_label", step: "0.01" },
  { key: "vax_dur", labelKey: "vax_immunity_dur_label", step: "1" },
  { key: "epsilon_n", labelKey: "nat_immunity_eff_label", step: "0.01" },
  { key: "nat_dur", labelKey: "nat_immunity_dur_label", step: "1" }
] as const;

type ModalState = { type: "variant" | "intervention"; editIndex: number | null } | null;

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return deepCopy(fallback);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return deepCopy(fallback);
  }
}

function saveStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function pathForLine(values: number[], maxValue: number, width: number, height: number, padding: number): string {
  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (value / Math.max(maxValue, 1)) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderChart(series: SimulationSeries, labels: Labels): string {
  const width = 960;
  const height = 420;
  const padding = 42;
  const maxValue = Math.max(...series.S, ...series.E, ...series.I, ...series.R, ...series.V, ...series.D, 1);
  const lastDay = series.t[series.t.length - 1] ?? 0;
  const lines = [
    { values: series.S, color: "#1768ac", label: labels.susceptible_legend ?? "S" },
    { values: series.E, color: "#f59e0b", label: labels.exposed_legend ?? "E" },
    { values: series.I, color: "#dc2626", label: labels.infected_legend ?? "I" },
    { values: series.R, color: "#15803d", label: labels.recovered_legend ?? "R" },
    { values: series.V, color: "#7c3aed", label: labels.vaccinated_legend ?? "V" },
    { values: series.D, color: "#111827", label: labels.deceased_legend ?? "D" }
  ];

  const grid = Array.from({ length: 6 }, (_, index) => {
    const y = padding + ((height - padding * 2) / 5) * index;
    const value = Math.round(maxValue - (maxValue / 5) * index).toLocaleString();
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="grid-line" /><text x="8" y="${y + 4}" class="axis-label">${value}</text>`;
  }).join("");

  const ticks = Array.from({ length: 6 }, (_, index) => {
    const x = padding + ((width - padding * 2) / 5) * index;
    const day = Math.round((lastDay / 5) * index);
    return `<line x1="${x}" y1="${height - padding}" x2="${x}" y2="${padding}" class="grid-line grid-line--vertical" /><text x="${x}" y="${height - 12}" text-anchor="middle" class="axis-label">${day}</text>`;
  }).join("");

  return `
    <div class="chart-shell">
      <svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="SEIRS simulation chart">
        ${grid}
        ${ticks}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line" />
        <line x1="${padding}" y1="${height - padding}" x2="${padding}" y2="${padding}" class="axis-line" />
        ${lines.map((line) => `<path d="${pathForLine(line.values, maxValue, width, height, padding)}" fill="none" stroke="${line.color}" stroke-width="3" stroke-linecap="round" />`).join("")}
      </svg>
      <div class="legend">
        ${lines.map((line) => `<div class="legend-item"><span class="legend-swatch" style="background:${line.color}"></span><span>${line.label}</span></div>`).join("")}
      </div>
    </div>
  `;
}

function renderSummary(series: SimulationSeries): string {
  const peak = Math.max(...series.I);
  const peakDay = series.I.indexOf(peak);
  const deaths = series.D[series.D.length - 1] ?? 0;
  const vaccinated = series.V[series.V.length - 1] ?? 0;

  return `
    <div class="summary-grid">
      <article class="summary-card"><span>최대 감염자</span><strong>${Math.round(peak).toLocaleString()}</strong></article>
      <article class="summary-card"><span>최대 감염일</span><strong>${peakDay}일</strong></article>
      <article class="summary-card"><span>최종 백신 접종자</span><strong>${Math.round(vaccinated).toLocaleString()}</strong></article>
      <article class="summary-card"><span>누적 사망자</span><strong>${Math.round(deaths).toLocaleString()}</strong></article>
    </div>
  `;
}

function variantRows(items: VariantScenario[], labels: Labels): string {
  return items
    .map((item, index) => {
      const summary = [
        item.params.beta !== undefined ? `beta ${percent(item.params.beta)}` : "",
        item.params.gamma !== undefined ? `gamma ${percent(item.params.gamma)}` : "",
        item.params.mu !== undefined ? `mu ${percent(item.params.mu)}` : ""
      ]
        .filter(Boolean)
        .join(" / ");

      return `<tr><td>${item.day}</td><td>${item.name}</td><td>${summary || "-"}</td><td><button class="table-button" data-action="edit-variant" data-index="${index}">${labels.save_button ?? "편집"}</button></td></tr>`;
    })
    .join("");
}

function interventionRows(items: Intervention[], labels: Labels): string {
  return items
    .map((item, index) => `<tr><td>${item.day}</td><td>${item.multiplier.toFixed(2)}</td><td>${item.reason}</td><td><button class="table-button" data-action="edit-intervention" data-index="${index}">${labels.save_button ?? "편집"}</button></td></tr>`)
    .join("");
}

function advancedField(label: string, id: string, value: number, step = "0.01"): string {
  return `<label class="field"><span>${label}</span><input id="${id}" type="number" step="${step}" value="${value}" /></label>`;
}

function modalMarkup(state: AppState, modal: ModalState): string {
  if (!modal) {
    return "";
  }

  if (modal.type === "intervention") {
    const item = modal.editIndex === null
      ? { day: 30, multiplier: 1.0, reason: "New Intervention" }
      : deepCopy(state.interventions[modal.editIndex]);

    return `
      <div class="modal-backdrop" data-close-modal="true">
        <div class="modal">
          <div class="modal-header"><h3>${state.labels.interventions_title ?? "개입 시나리오 편집기"}</h3><button class="ghost-button" data-action="close-modal">닫기</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>${state.labels.intervention_day_label ?? "시작일"}</span><input id="intervention-day" type="number" step="1" value="${item.day}" /></label>
              <label class="field"><span>${state.labels.intervention_multiplier_label ?? "감염률 배수"}</span><input id="intervention-multiplier" type="number" step="0.01" value="${item.multiplier}" /></label>
              <label class="field field--wide"><span>${state.labels.intervention_reason_label ?? "개입 사유"}</span><input id="intervention-reason" type="text" value="${item.reason}" /></label>
            </div>
          </div>
          <div class="modal-actions">
            ${modal.editIndex !== null ? '<button class="danger-button" data-action="delete-intervention">삭제</button>' : '<span></span>'}
            <button class="primary-button" data-action="save-intervention">${state.labels.save_and_close_button ?? "저장하고 닫기"}</button>
          </div>
        </div>
      </div>
    `;
  }

  const variant = modal.editIndex === null
    ? { day: 30, name: "New Variant", params: {} as VariantScenario["params"] }
    : deepCopy(state.variants[modal.editIndex]);

  return `
    <div class="modal-backdrop" data-close-modal="true">
      <div class="modal">
        <div class="modal-header"><h3>${state.labels.variants_title ?? "변이 시나리오 편집기"}</h3><button class="ghost-button" data-action="close-modal">닫기</button></div>
        <div class="modal-body">
          <label class="field"><span>프리셋</span><select id="variant-preset"><option value="사용자 정의">사용자 정의</option>${Object.keys(state.presets).filter((name) => name !== "사용자 정의").map((name) => `<option value="${name}">${name}</option>`).join("")}</select></label>
          <div class="form-grid">
            <label class="field"><span>${state.labels.variant_day_label ?? "시작일 (Day)"}</span><input id="variant-day" type="number" step="1" value="${variant.day}" ${variant.day === 0 ? "disabled" : ""} /></label>
            <label class="field"><span>${state.labels.variant_name_label ?? "변이 이름"}</span><input id="variant-name" type="text" value="${variant.name}" ${variant.day === 0 ? "disabled" : ""} /></label>
            ${parameterFieldDefs.map(({ key, labelKey, step }) => {
              const current = variant.params[key as keyof VariantScenario["params"]];
              const displayValue = typeof current === "number" && ["beta", "gamma", "mu", "epsilon_v", "epsilon_n", "xi"].includes(key) ? (current * 100).toFixed(2) : (current ?? "");
              return `<label class="field"><span>${state.labels[labelKey] ?? key}</span><input id="variant-param-${key}" type="number" step="${step}" value="${displayValue}" /></label>`;
            }).join("")}
          </div>
        </div>
        <div class="modal-actions">
          ${modal.editIndex !== null && variant.day !== 0 ? '<button class="danger-button" data-action="delete-variant">삭제</button>' : '<span></span>'}
          <button class="primary-button" data-action="save-variant">${state.labels.save_and_close_button ?? "저장하고 닫기"}</button>
        </div>
      </div>
    </div>
  `;
}

function readNumber(root: ParentNode, id: string): number {
  return Number(root.querySelector<HTMLInputElement>(`#${id}`)?.value ?? 0);
}

export function mountApp(
  target: HTMLElement,
  labels: Labels,
  presets: Record<string, VirusPreset>,
  defaultVariants: VariantScenario[],
  defaultInterventions: Intervention[]
): void {
  const state: AppState = {
    labels,
    presets,
    defaultVariants: deepCopy(defaultVariants),
    defaultInterventions: deepCopy(defaultInterventions),
    inputs: { population: 1_000_000, initialInfected: 10, simulationDays: 365, vaccinationStartDay: 30 },
    advanced: {
      beta: 20,
      gamma: 10,
      mu: 1,
      incubationPeriod: 5,
      naturalImmunityEffectiveness: 90,
      naturalImmunityDuration: 180,
      vaccineEffectiveness: 95,
      vaccineDuration: 365,
      vaccinationRate: 1,
      recoveredVaccineMultiplier: 1.5
    },
    useVariants: false,
    useInterventions: false,
    variants: loadStorage(STORAGE_KEYS.variants, defaultVariants),
    interventions: loadStorage(STORAGE_KEYS.interventions, defaultInterventions)
  };

  let notice = "상단 설정을 조정한 뒤 시뮬레이션을 실행하세요.";
  let chart = "";
  let summary = "";
  let modal: ModalState = null;

  function syncBaseVariant(): void {
    const baseVariant = buildBaseVariant(state.advanced);
    if (state.variants.length === 0) {
      state.variants.push(baseVariant);
    } else {
      state.variants[0] = { day: 0, name: state.variants[0].name || "Base Settings", params: baseVariant.params };
    }
    saveStorage(STORAGE_KEYS.variants, state.variants);
  }

  function applyPreset(name: string): void {
    const preset = state.presets[name];
    if (!preset) {
      return;
    }

    state.advanced.beta = (preset.beta ?? state.advanced.beta / 100) * 100;
    state.advanced.gamma = (preset.gamma ?? state.advanced.gamma / 100) * 100;
    state.advanced.mu = (preset.mu ?? state.advanced.mu / 100) * 100;
    state.advanced.incubationPeriod = preset.incubation_period ?? state.advanced.incubationPeriod;
    if (preset.natural_immunity_effectiveness !== undefined) state.advanced.naturalImmunityEffectiveness = preset.natural_immunity_effectiveness * 100;
    if (preset.natural_immunity_duration !== undefined) state.advanced.naturalImmunityDuration = preset.natural_immunity_duration;
    if (preset.vaccine_effectiveness !== undefined) state.advanced.vaccineEffectiveness = preset.vaccine_effectiveness * 100;
    if (preset.vaccine_duration !== undefined) state.advanced.vaccineDuration = preset.vaccine_duration;
    if (preset.cross_immunity !== undefined) state.advanced.vaccinationRate = preset.cross_immunity * 100;
    if (preset.recovered_vaccine_multiplier !== undefined) state.advanced.recoveredVaccineMultiplier = preset.recovered_vaccine_multiplier;
    render();
  }

  function render(): void {
    syncBaseVariant();
    target.innerHTML = `
      <div class="app-shell">
        <header class="hero">
          <div>
            <p class="eyebrow">Frontend Only</p>
            <h1>${state.labels.window_title ?? "SEIRS 모델 시뮬레이터"}</h1>
            <p class="hero-copy">Python Tkinter 앱의 계산 로직과 시나리오 편집 흐름을 브라우저 안으로 옮긴 정적 TypeScript 앱입니다.</p>
          </div>
          <div class="hero-stat"><span>기본 R0</span><strong>${(state.advanced.beta / Math.max(state.advanced.gamma, 0.01)).toFixed(2)}</strong></div>
        </header>

        <main class="layout">
          <section class="panel">
            <div class="panel-header"><h2>${state.labels.parameters_title ?? "기본 설정"}</h2></div>
            <div class="form-grid">
              ${advancedField(state.labels.population_label ?? "총인구", "population", state.inputs.population, "1")}
              ${advancedField(state.labels.initial_infected_label ?? "초기 감염자", "initialInfected", state.inputs.initialInfected, "1")}
              ${advancedField(state.labels.sim_duration_label ?? "시뮬레이션 기간", "simulationDays", state.inputs.simulationDays, "1")}
              ${advancedField(state.labels.vax_start_day_label ?? "백신 접종 시작일", "vaccinationStartDay", state.inputs.vaccinationStartDay, "1")}
            </div>
            <div class="toggle-grid">
              <label class="toggle"><input id="useVariants" type="checkbox" ${state.useVariants ? "checked" : ""} /><span>${state.labels.use_variants_label ?? "변이 시나리오 사용"}</span></label>
              <label class="toggle"><input id="useInterventions" type="checkbox" ${state.useInterventions ? "checked" : ""} /><span>${state.labels.use_interventions_label ?? "개입 시나리오 사용"}</span></label>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2>${state.labels.adv_settings_title ?? "상세 설정"}</h2>
              <select id="presetSelect" class="preset-select"><option value="">프리셋 선택</option>${Object.keys(state.presets).map((name) => `<option value="${name}">${name}</option>`).join("")}</select>
            </div>
            <div class="form-grid">
              ${advancedField(state.labels.infection_rate_label ?? "beta", "beta", state.advanced.beta)}
              ${advancedField(state.labels.recovery_rate_label ?? "gamma", "gamma", state.advanced.gamma)}
              ${advancedField(state.labels.mortality_rate_label ?? "mu", "mu", state.advanced.mu)}
              ${advancedField(state.labels.incubation_period_label ?? "incubation", "incubationPeriod", state.advanced.incubationPeriod, "1")}
              ${advancedField(state.labels.nat_immunity_eff_label ?? "natural efficacy", "naturalImmunityEffectiveness", state.advanced.naturalImmunityEffectiveness)}
              ${advancedField(state.labels.nat_immunity_dur_label ?? "natural duration", "naturalImmunityDuration", state.advanced.naturalImmunityDuration, "1")}
              ${advancedField(state.labels.vax_efficacy_label ?? "vaccine efficacy", "vaccineEffectiveness", state.advanced.vaccineEffectiveness)}
              ${advancedField(state.labels.vax_immunity_dur_label ?? "vaccine duration", "vaccineDuration", state.advanced.vaccineDuration, "1")}
              ${advancedField(state.labels.vax_rate_label ?? "vaccination rate", "vaccinationRate", state.advanced.vaccinationRate)}
              ${advancedField(state.labels.rec_vax_multiplier_label ?? "recovered vaccine multiplier", "recoveredVaccineMultiplier", state.advanced.recoveredVaccineMultiplier)}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>${state.labels.variants_title ?? "변이 시나리오 편집기"}</h2><div class="button-row"><button class="secondary-button" data-action="reset-variants">초기화</button><button class="primary-button" data-action="new-variant">추가</button></div></div>
            <div class="table-wrap"><table><thead><tr><th>Day</th><th>이름</th><th>요약</th><th>편집</th></tr></thead><tbody>${variantRows(state.variants, state.labels)}</tbody></table></div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>${state.labels.interventions_title ?? "개입 시나리오 편집기"}</h2><div class="button-row"><button class="secondary-button" data-action="reset-interventions">초기화</button><button class="primary-button" data-action="new-intervention">추가</button></div></div>
            <div class="table-wrap"><table><thead><tr><th>Day</th><th>배수</th><th>사유</th><th>편집</th></tr></thead><tbody>${interventionRows(state.interventions, state.labels)}</tbody></table></div>
          </section>

          <section class="panel panel--full">
            <div class="panel-header"><h2>${state.labels.simulation_result_title ?? "시뮬레이션 결과"}</h2><button class="primary-button" data-action="run-simulation">${state.labels.run_button ?? "시뮬레이션 실행"}</button></div>
            <p class="notice">${notice}</p>
            ${summary}
            ${chart || '<div class="empty-state">실행 전에는 그래프가 표시되지 않습니다.</div>'}
          </section>
        </main>
        ${modalMarkup(state, modal)}
      </div>
    `;

    bindEvents();
  }

  function bindValue(id: string, onChange: (value: number) => void): void {
    target.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", (event) => {
      onChange(Number((event.currentTarget as HTMLInputElement).value));
    });
  }

  function sortAndSave(): void {
    state.variants.sort((a, b) => a.day - b.day);
    state.interventions.sort((a, b) => a.day - b.day);
    saveStorage(STORAGE_KEYS.variants, state.variants);
    saveStorage(STORAGE_KEYS.interventions, state.interventions);
  }

  function bindEvents(): void {
    bindValue("population", (value) => { state.inputs.population = value; });
    bindValue("initialInfected", (value) => { state.inputs.initialInfected = value; });
    bindValue("simulationDays", (value) => { state.inputs.simulationDays = value; });
    bindValue("vaccinationStartDay", (value) => { state.inputs.vaccinationStartDay = value; });
    bindValue("beta", (value) => { state.advanced.beta = value; });
    bindValue("gamma", (value) => { state.advanced.gamma = value; });
    bindValue("mu", (value) => { state.advanced.mu = value; });
    bindValue("incubationPeriod", (value) => { state.advanced.incubationPeriod = value; });
    bindValue("naturalImmunityEffectiveness", (value) => { state.advanced.naturalImmunityEffectiveness = value; });
    bindValue("naturalImmunityDuration", (value) => { state.advanced.naturalImmunityDuration = value; });
    bindValue("vaccineEffectiveness", (value) => { state.advanced.vaccineEffectiveness = value; });
    bindValue("vaccineDuration", (value) => { state.advanced.vaccineDuration = value; });
    bindValue("vaccinationRate", (value) => { state.advanced.vaccinationRate = value; });
    bindValue("recoveredVaccineMultiplier", (value) => { state.advanced.recoveredVaccineMultiplier = value; });

    target.querySelector<HTMLInputElement>("#useVariants")?.addEventListener("change", (event) => {
      state.useVariants = (event.currentTarget as HTMLInputElement).checked;
    });
    target.querySelector<HTMLInputElement>("#useInterventions")?.addEventListener("change", (event) => {
      state.useInterventions = (event.currentTarget as HTMLInputElement).checked;
    });
    target.querySelector<HTMLSelectElement>("#presetSelect")?.addEventListener("change", (event) => {
      applyPreset((event.currentTarget as HTMLSelectElement).value);
    });

    target.querySelectorAll<HTMLElement>("[data-close-modal]").forEach((element) => {
      element.addEventListener("click", (event) => {
        if (event.target === element) {
          modal = null;
          render();
        }
      });
    });

    target.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
      element.addEventListener("click", () => {
        const action = element.dataset.action;
        const index = element.dataset.index ? Number(element.dataset.index) : null;

        if (action === "run-simulation") {
          try {
            const result = runSimulation(state.inputs.population, state.inputs.initialInfected, state.inputs.simulationDays, state.inputs.vaccinationStartDay, state.advanced, state.useVariants, state.useInterventions, state.variants, state.interventions);
            notice = "시뮬레이션이 정상적으로 완료되었습니다.";
            summary = renderSummary(result);
            chart = renderChart(result, state.labels);
          } catch (error) {
            notice = error instanceof Error ? error.message : "시뮬레이션 오류";
            summary = "";
            chart = "";
          }
          render();
          return;
        }

        if (action === "new-variant") {
          modal = { type: "variant", editIndex: null };
          render();
          return;
        }

        if (action === "edit-variant" && index !== null) {
          modal = { type: "variant", editIndex: index };
          render();
          return;
        }

        if (action === "new-intervention") {
          modal = { type: "intervention", editIndex: null };
          render();
          return;
        }

        if (action === "edit-intervention" && index !== null) {
          modal = { type: "intervention", editIndex: index };
          render();
          return;
        }

        if (action === "reset-variants") {
          state.variants = deepCopy(state.defaultVariants);
          sortAndSave();
          render();
          return;
        }

        if (action === "reset-interventions") {
          state.interventions = deepCopy(state.defaultInterventions);
          sortAndSave();
          render();
          return;
        }

        if (action === "close-modal") {
          modal = null;
          render();
          return;
        }

        if (action === "delete-variant" && modal?.type === "variant" && modal.editIndex !== null && state.variants[modal.editIndex]?.day !== 0) {
          state.variants.splice(modal.editIndex, 1);
          sortAndSave();
          modal = null;
          render();
          return;
        }

        if (action === "delete-intervention" && modal?.type === "intervention" && modal.editIndex !== null) {
          state.interventions.splice(modal.editIndex, 1);
          sortAndSave();
          modal = null;
          render();
          return;
        }

        if (action === "save-intervention") {
          const draft: Intervention = {
            day: readNumber(target, "intervention-day"),
            multiplier: readNumber(target, "intervention-multiplier"),
            reason: target.querySelector<HTMLInputElement>("#intervention-reason")?.value || "Unnamed Intervention"
          };
          const editIndex = modal?.editIndex;
          if (editIndex === null) state.interventions.push(draft);
          else if (editIndex !== undefined) state.interventions[editIndex] = draft;
          sortAndSave();
          modal = null;
          render();
          return;
        }

        if (action === "save-variant") {
          const draft: VariantScenario = {
            day: readNumber(target, "variant-day"),
            name: target.querySelector<HTMLInputElement>("#variant-name")?.value || "Unnamed Variant",
            params: {}
          };
          const editIndex = modal?.editIndex;
          if (editIndex !== null && editIndex !== undefined && state.variants[editIndex]?.day === 0) {
            draft.day = 0;
            draft.name = state.variants[editIndex].name;
          }
          for (const field of parameterFieldDefs) {
            const raw = target.querySelector<HTMLInputElement>(`#variant-param-${field.key}`)?.value.trim();
            if (!raw) continue;
            const parsed = Number(raw);
            draft.params[field.key as keyof VariantScenario["params"]] = ["beta", "gamma", "mu", "epsilon_v", "epsilon_n", "xi"].includes(field.key) ? parsed / 100 : parsed;
          }
          if (editIndex === null) state.variants.push(draft);
          else if (editIndex !== undefined) state.variants[editIndex] = draft;
          sortAndSave();
          modal = null;
          render();
        }
      });
    });
  }

  render();
}
