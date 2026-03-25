import type {
  AdvancedInputs,
  Intervention,
  SimulationSeries,
  VariantParams,
  VariantScenario
} from "./types";

type Compartments = [number, number, number, number, number, number];

function currentParams(day: number, variants: VariantScenario[]): Required<VariantParams> {
  const layered: VariantParams = {};

  for (const variant of [...variants].sort((a, b) => a.day - b.day)) {
    if (day >= variant.day) {
      Object.assign(layered, variant.params);
    }
  }

  return {
    beta: layered.beta ?? 0.2,
    gamma: layered.gamma ?? 0.1,
    mu: layered.mu ?? 0.01,
    incubation_period: layered.incubation_period ?? 5,
    epsilon_n: layered.epsilon_n ?? 0.98,
    nat_dur: layered.nat_dur ?? 180,
    epsilon_v: layered.epsilon_v ?? 0.95,
    vax_dur: layered.vax_dur ?? 365,
    xi: layered.xi ?? 0.01,
    xi_r_multiplier: layered.xi_r_multiplier ?? 1.0
  };
}

function currentMultiplier(day: number, interventions: Intervention[]): number {
  let multiplier = 1.0;

  for (const item of [...interventions].sort((a, b) => a.day - b.day)) {
    if (day >= item.day) {
      multiplier = item.multiplier;
    }
  }

  return multiplier;
}

function seirsDifferential(
  day: number,
  state: Compartments,
  population: number,
  vaccinationStartDay: number,
  variants: VariantScenario[],
  interventions: Intervention[]
): Compartments {
  const params = currentParams(day, variants);
  const multiplier = currentMultiplier(day, interventions);
  const beta = params.beta * multiplier;
  const gamma = params.gamma;
  const mu = params.mu;
  const alpha = params.incubation_period > 0 ? 1 / params.incubation_period : 0;
  const omegaN = params.nat_dur > 0 ? 1 / params.nat_dur : 0;
  const omegaV = params.vax_dur > 0 ? 1 / params.vax_dur : 0;

  const [S, E, I, R, V] = state;
  const xiS = day >= vaccinationStartDay ? params.xi : 0;
  const xiR = day >= vaccinationStartDay ? params.xi * params.xi_r_multiplier : 0;

  const infectionFromS = beta * S * I / population;
  const infectionFromV = beta * (1 - params.epsilon_v) * V * I / population;
  const infectionFromR = beta * (1 - params.epsilon_n) * R * I / population;

  const waningN = omegaN * R;
  const waningV = omegaV * V;
  const vaccinateS = xiS * S;
  const vaccinateR = xiR * R;
  const vaccinateE = xiS * E;

  return [
    -infectionFromS - vaccinateS + waningN + waningV,
    infectionFromS + infectionFromV + infectionFromR - vaccinateE - alpha * E,
    alpha * E - (gamma + mu) * I,
    gamma * I - infectionFromR - vaccinateR - waningN,
    vaccinateS + vaccinateR + vaccinateE - infectionFromV - waningV,
    mu * I
  ];
}

function addState(base: Compartments, delta: Compartments, factor: number): Compartments {
  return base.map((value, index) => value + delta[index] * factor) as Compartments;
}

function clampState(state: Compartments): Compartments {
  return state.map((value) => Math.max(0, value)) as Compartments;
}

function rk4Step(
  day: number,
  state: Compartments,
  dt: number,
  population: number,
  vaccinationStartDay: number,
  variants: VariantScenario[],
  interventions: Intervention[]
): Compartments {
  const k1 = seirsDifferential(day, state, population, vaccinationStartDay, variants, interventions);
  const k2 = seirsDifferential(day + dt / 2, addState(state, k1, dt / 2), population, vaccinationStartDay, variants, interventions);
  const k3 = seirsDifferential(day + dt / 2, addState(state, k2, dt / 2), population, vaccinationStartDay, variants, interventions);
  const k4 = seirsDifferential(day + dt, addState(state, k3, dt), population, vaccinationStartDay, variants, interventions);

  return clampState(
    state.map((value, index) => value + (dt / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index])) as Compartments
  );
}

export function buildBaseVariant(advanced: AdvancedInputs): VariantScenario {
  return {
    day: 0,
    name: "Base Settings",
    params: {
      beta: advanced.beta / 100,
      gamma: advanced.gamma / 100,
      mu: advanced.mu / 100,
      incubation_period: advanced.incubationPeriod,
      epsilon_n: advanced.naturalImmunityEffectiveness / 100,
      nat_dur: advanced.naturalImmunityDuration,
      epsilon_v: advanced.vaccineEffectiveness / 100,
      vax_dur: advanced.vaccineDuration,
      xi: advanced.vaccinationRate / 100,
      xi_r_multiplier: advanced.recoveredVaccineMultiplier
    }
  };
}

export function runSimulation(
  population: number,
  initialInfected: number,
  days: number,
  vaccinationStartDay: number,
  advanced: AdvancedInputs,
  useVariants: boolean,
  useInterventions: boolean,
  scenarioVariants: VariantScenario[],
  interventions: Intervention[]
): SimulationSeries {
  const baseVariant = buildBaseVariant(advanced);
  const finalVariants = [baseVariant, ...(useVariants ? scenarioVariants.filter((item) => item.day > 0) : [])];
  const finalInterventions = useInterventions ? interventions : [];
  const alpha = advanced.incubationPeriod > 0 ? 1 / advanced.incubationPeriod : 0;
  const exposed = alpha > 0 ? Math.floor((baseVariant.params.beta! / alpha) * initialInfected) : 0;
  const susceptible = population - initialInfected - exposed;

  if (susceptible < 0) {
    throw new Error("초기 감염/잠복자 수가 총인구보다 많을 수 없습니다.");
  }

  let current: Compartments = [susceptible, exposed, initialInfected, 0, 0, 0];
  const series: SimulationSeries = { t: [], S: [], E: [], I: [], R: [], V: [], D: [] };
  const substeps = 8;
  const dt = 1 / substeps;

  for (let day = 0; day <= days; day += 1) {
    series.t.push(day);
    series.S.push(current[0]);
    series.E.push(current[1]);
    series.I.push(current[2]);
    series.R.push(current[3]);
    series.V.push(current[4]);
    series.D.push(current[5]);

    if (day === days) {
      break;
    }

    for (let step = 0; step < substeps; step += 1) {
      current = rk4Step(day + step * dt, current, dt, population, vaccinationStartDay, finalVariants, finalInterventions);
    }
  }

  return series;
}
