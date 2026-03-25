export type Labels = Record<string, string>;

export interface VirusPreset {
  description?: string;
  beta?: number;
  gamma?: number;
  mu?: number;
  incubation_period?: number;
  natural_immunity_effectiveness?: number;
  natural_immunity_duration?: number;
  vaccine_effectiveness?: number;
  vaccine_duration?: number;
  cross_immunity?: number;
  recovered_vaccine_multiplier?: number;
}

export interface VariantParams {
  beta?: number;
  gamma?: number;
  mu?: number;
  incubation_period?: number;
  epsilon_n?: number;
  nat_dur?: number;
  epsilon_v?: number;
  vax_dur?: number;
  xi?: number;
  xi_r_multiplier?: number;
}

export interface VariantScenario {
  day: number;
  name: string;
  params: VariantParams;
}

export interface Intervention {
  day: number;
  multiplier: number;
  reason: string;
}

export interface BasicInputs {
  population: number;
  initialInfected: number;
  simulationDays: number;
  vaccinationStartDay: number;
}

export interface AdvancedInputs {
  beta: number;
  gamma: number;
  mu: number;
  incubationPeriod: number;
  naturalImmunityEffectiveness: number;
  naturalImmunityDuration: number;
  vaccineEffectiveness: number;
  vaccineDuration: number;
  vaccinationRate: number;
  recoveredVaccineMultiplier: number;
}

export interface AppState {
  labels: Labels;
  presets: Record<string, VirusPreset>;
  defaultVariants: VariantScenario[];
  defaultInterventions: Intervention[];
  inputs: BasicInputs;
  advanced: AdvancedInputs;
  useVariants: boolean;
  useInterventions: boolean;
  variants: VariantScenario[];
  interventions: Intervention[];
}

export interface SimulationSeries {
  t: number[];
  S: number[];
  E: number[];
  I: number[];
  R: number[];
  V: number[];
  D: number[];
}
