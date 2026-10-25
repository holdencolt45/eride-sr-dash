/**
 * Turkey Bay, Oct 23.
 * 343.1 mi at 100% SOC, then 365 mi at 19% SOC.
 * 21.9 mi ridden. With a 3.0 kWh pack that settles near 27 mi full.
 */
export const SEED_SESSION = {
  id: "turkey-bay-2026-10-23",
  name: "Turkey Bay",
  startedAt: new Date(2026, 9, 23, 13, 5).getTime(),
  points: [
    {
      t: new Date(2026, 9, 23, 13, 5).getTime(),
      odoMi: 343.1,
      socPct: 100,
      packVoltageV: null,
    },
    {
      t: new Date(2026, 9, 23, 15, 40).getTime(),
      odoMi: 365,
      socPct: 19,
      packVoltageV: null,
    },
  ],
};
