// CS:GO Panorama timing reconstructed from popup_capability_decodable.js/.css.
// Reference: https://github.com/Desynci/CSGO_Panorama_Code.pbin

export const OPENING_DELAY_MS = 2400;
export const SPIN_DURATION_MS = 6000;

export const TICK_SECONDS = [
  0,
  0.063,
  0.125,
  0.188,
  0.25,
  0.313,
  0.375,
  0.438,
  0.5,
  0.563,
  0.625,
  0.688,
  0.75,
  0.813,
  0.875,
  0.938,
  1,
  1.063,
  1.125,
  1.188,
  1.25,
  1.313,
  1.375,
  1.483,
  1.351,
  1.62,
  1.701,
  1.786,
  1.872,
  2.003,
  2.154,
  2.313,
  2.466,
  2.615,
  2.773,
  2.941,
  3.104,
  3.339,
  3.63,
  3.953,
  4.385,
  5.004
].sort((a, b) => a - b);

// Giá mục tiêu, đơn vị nghìn đồng.
export const TARGET_LUNCH_PRICE = 50;

// Mức phân tán giá.
export const LOG_PRICE_SPREAD = 0.35;

// Món được ưu tiên.
export const SPECIAL_MEAL_NAME = "Anh Hưng";

// 0.5 tương ứng với 50%.
export const SPECIAL_MEAL_PROBABILITY = 0.5;

export function caseEase(progress: number) {
  const p = Math.max(0, Math.min(1, progress));

  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    const u = 1 - t;

    const x =
      3 * u * u * t * 0.075 +
      3 * u * t * t * 0.165 +
      t * t * t;

    if (x < p) {
      lo = t;
    } else {
      hi = t;
    }
  }

  const t = (lo + hi) / 2;
  const u = 1 - t;

  return (
    3 * u * u * t * 0.82 +
    3 * u * t * t +
    t * t * t
  );
}

type PricedMeal = {
  name: string;
  price: number;
  rarity: number;
};

export function createFoodSelector<T extends PricedMeal>(
  population: T[],
  target = TARGET_LUNCH_PRICE
) {
  if (!population.length) {
    throw new Error("No meals in population");
  }

  if (!Number.isFinite(target) || target <= 0) {
    throw new Error("Invalid target");
  }

  if (
    population.some(
      food =>
        !Number.isFinite(food.price) ||
        food.price <= 0
    )
  ) {
    throw new Error("Invalid meal price");
  }

  const minimumPrice = Math.min(
    ...population.map(food => food.price)
  );

  const maximumPrice = Math.max(
    ...population.map(food => food.price)
  );

  if (target < minimumPrice || target > maximumPrice) {
    throw new Error(
      "Target mean is outside feasible meal prices"
    );
  }

  /*
   * Mỗi mức giá có tổng trọng số bằng nhau.
   * Nếu nhiều món có cùng giá, trọng số của mức giá đó
   * được chia cho các món.
   */
  const counts = new Map<number, number>();

  population.forEach(food => {
    counts.set(
      food.price,
      (counts.get(food.price) || 0) + 1
    );
  });

  const logs = population.map(food =>
    Math.log(food.price / 50)
  );

  const prior = logs.map((value, index) => {
    const numberOfMealsAtPrice =
      counts.get(population[index].price) || 1;

    return (
      -0.5 *
        (value / LOG_PRICE_SPREAD) ** 2 -
      Math.log(numberOfMealsAtPrice)
    );
  });

  function calculateWeights(tilt: number) {
    const logits = logs.map(
      (value, index) =>
        prior[index] + tilt * value
    );

    const anchor = Math.max(...logits);

    const rawWeights = logits.map(value =>
      Math.exp(value - anchor)
    );

    const totalWeight = rawWeights.reduce(
      (total, value) => total + value,
      0
    );

    return rawWeights.map(
      value => value / totalWeight
    );
  }

  const calculateMean = (weights: number[]) =>
    population.reduce(
      (total, food, index) =>
        total + food.price * weights[index],
      0
    );

  let rawProbabilities: number[];

  if (
    target === minimumPrice ||
    target === maximumPrice
  ) {
    const numberAtTarget =
      counts.get(target) || 1;

    rawProbabilities = population.map(food =>
      food.price === target
        ? 1 / numberAtTarget
        : 0
    );
  } else {
    let lowTilt = -1;
    let highTilt = 1;

    while (
      calculateMean(
        calculateWeights(lowTilt)
      ) > target
    ) {
      lowTilt *= 2;
    }

    while (
      calculateMean(
        calculateWeights(highTilt)
      ) < target
    ) {
      highTilt *= 2;
    }

    for (let i = 0; i < 80; i++) {
      const middleTilt =
        (lowTilt + highTilt) / 2;

      if (
        calculateMean(
          calculateWeights(middleTilt)
        ) < target
      ) {
        lowTilt = middleTilt;
      } else {
        highTilt = middleTilt;
      }
    }

    rawProbabilities 
