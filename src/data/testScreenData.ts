// src/data/testScreenData.ts

export interface PresetLayout {
  name: string;
  layout: string;
  path: string;
}

export const multiviewPresets = [
  {
    name: "Full Court",
    layout: "grid",
    path: "/2x2",
  },
  {
    name: "Head-to-Head",
    layout: "horizontal",
    path: "/2x1",
  },
  {
    name: "Power Play",
    layout: "grid3x2",
    path: "/cover6",
  },
  {
    name: "Cover 6",
    layout: "cover-6",
    path: "/power-play",
  },
  {
    name: "Mismatch",
    layout: "Mismatch",
    path: "/mismatch",
  },
  {
    name: "Triple Threat",
    layout: "Triple-threat",
    path: "/triple-threat",
  },
  {
    name: "Single View",
    layout: "single-screen",
    path: "/screen/single"
  }
];

export const presets: PresetLayout[] = [
  {
    name: "Full Court",
    layout: "grid-cols-2 grid-rows-2",
    path: "",
  },
  {
    name: "Head-to-Head",
    layout: "grid-cols-2",
    path: "",
  },
  {
    name: "Cover 6",
    layout: "grid-cols-3",
    path: "",
  },
  {
    name: "Power Play",
    layout: "grid-cols-3",
    path: "",
  },
  {
    name: "Mismatch",
    layout: "grid-cols-2",
    path: "",
  },
];

export const recentlyVisited = [
  {
    src: "https://cdn.builder.io/api/v1/image/assets/afc0e1e2dd7e48de8fbea7e3b2140291/e8e225d630dcad1816a483464bb4fb60474d8036bb5f10cea74d73563da565de?apiKey=afc0e1e2dd7e48de8fbea7e3b2140291&",
    alt: "Recently visited item 1",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets/afc0e1e2dd7e48de8fbea7e3b2140291/fd3c9a3522f3dab2a27d1c82cad130f6745b2d8e42e26f3f17186ed356bbd76d?apiKey=afc0e1e2dd7e48de8fbea7e3b2140291&",
    alt: "Recently visited item 2",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets/afc0e1e2dd7e48de8fbea7e3b2140291/f8c814aba78c38ced2553263414673a370427d517a7d85e7afdc92e26f6f3b83?apiKey=afc0e1e2dd7e48de8fbea7e3b2140291&",
    alt: "Recently visited item 3",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets/afc0e1e2dd7e48de8fbea7e3b2140291/3f9faf6a8bc29781730dcbb8a71cb18e1867a2ac630c9b6cf40c3b3d16e889cc?apiKey=afc0e1e2dd7e48de8fbea7e3b2140291&",
    alt: "Recently visited item 4",
  },
];