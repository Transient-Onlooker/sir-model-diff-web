import { mountApp } from "./app";
import type { Intervention, Labels, VariantScenario, VirusPreset } from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json() as Promise<T>;
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    throw new Error("App root not found");
  }

  app.innerHTML = `<div class="loading">데이터를 불러오는 중입니다...</div>`;

  const [labels, presets, variants, interventions] = await Promise.all([
    fetchJson<Labels>("/data/ui_labels_ko.json"),
    fetchJson<Record<string, VirusPreset>>("/data/virus_presets.json"),
    fetchJson<VariantScenario[]>("/data/variants.json"),
    fetchJson<Intervention[]>("/data/interventions.json")
  ]);

  mountApp(app, labels, presets, variants, interventions);
}

bootstrap().catch((error) => {
  const app = document.querySelector<HTMLElement>("#app");
  if (app) {
    app.innerHTML = `<div class="loading">앱을 초기화하지 못했습니다. ${error instanceof Error ? error.message : "Unknown error"}</div>`;
  }
});
