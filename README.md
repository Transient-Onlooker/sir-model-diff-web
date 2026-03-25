# sir-model-diff-web

A frontend-only SEIRS simulator built with TypeScript and Vite.

The app runs entirely in the browser and visualizes `S / E / I / R / V / D` time-series data while supporting:

- virus presets
- variant scenarios
- intervention scenarios
- vaccination and immunity parameters
- local scenario persistence with `localStorage`

## Features

- SEIRS-style compartment model with vaccinated and deceased compartments
- RK4-based numerical integration
- Variant scenarios that override parameters from a given day
- Intervention scenarios that change transmission multiplier from a given day
- Editable simulation inputs and advanced disease parameters
- SVG chart rendering in the browser
- JSON-driven presets and labels from `public/data`

## Tech Stack

- TypeScript
- Vite
- Vanilla DOM rendering

## Requirements

- Node.js 18+
- npm

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

You can also use the Windows helper script:

```bat
run.bat
```

## Available Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - run TypeScript compile and production build
- `npm run preview` - preview the production build

## Project Structure

```text
.
├─ public/
│  └─ data/
│     ├─ interventions.json
│     ├─ ui_labels_ko.json
│     ├─ variants.json
│     └─ virus_presets.json
├─ src/
│  ├─ app.ts
│  ├─ main.ts
│  ├─ simulation.ts
│  ├─ style.css
│  └─ types.ts
├─ package.json
├─ run.bat
└─ vite.config.ts
```

## Model Notes

The simulation tracks these compartments:

- `S` susceptible
- `E` exposed
- `I` infected
- `R` recovered
- `V` vaccinated
- `D` deceased

Core parameters include:

- `beta`
- `gamma`
- `mu`
- `incubation_period`
- `epsilon_n`
- `nat_dur`
- `epsilon_v`
- `vax_dur`
- `xi`
- `xi_r_multiplier`

The solver uses RK4 with 8 substeps per simulated day.

## Data Files

The app loads initial data from `public/data`:

- `ui_labels_ko.json` - UI labels
- `virus_presets.json` - preset disease parameter sets
- `variants.json` - default variant scenario list
- `interventions.json` - default intervention scenario list

## Local Storage Keys

- `sir-model-diff-web:variants`
- `sir-model-diff-web:interventions`

## Notes

- This project is fully client-side and does not require a backend.
- It is suitable for learning, experimentation, and visualization, not for real-world medical or policy decisions.
