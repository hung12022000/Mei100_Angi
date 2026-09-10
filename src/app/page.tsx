// CS:GO Panorama timing reconstructed from
// popup_capability_decodable.js/.css.
// Reference:
// https://github.com/Desynci/CSGO_Panorama_Code.pbin

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

// Tên món đặc biệt.
export const SPECIAL_MEAL_NAME = "Anh Hưng";

// Xác suất 50%.
export const SPECIAL_MEAL_PROBABILITY = 0.5;

export function caseEase(progress: number): number {
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

function normalizeMealName(name: string): string {
  return name.trim().normalize("NFC").toLocaleLowerCase("vi");
}

function isSpecialMeal<T extends PricedMeal>(food: T): boolean {
  return (
    normalizeMealName(food.name) ===
    normalizeMealName(SPECIAL_MEAL_NAME)
  );
}

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
   * Đếm số món theo từng mức giá.
   * Nhiều món cùng giá sẽ chia trọng số của mức giá đó.
   */
  const counts = new Map<number, number>();

  population.forEach(food => {
    counts.set(
      food.price,
      (counts.get(food.price) ?? 0) + 1
    );
  });

  const logs = population.map(food =>
    Math.log(food.price / TARGET_LUNCH_PRICE)
  );

  const prior = logs.map((value, index) => {
    const countAtPrice =
      counts.get(population[index].price) ?? 1;

    return (
      -0.5 *
        Math.pow(
          value / LOG_PRICE_SPREAD,
          2
        ) -
      Math.log(countAtPrice)
    );
  });

  function calculateWeights(tilt: number): number[] {
    const logits = logs.map(
      (value, index) =>
        prior[index] + tilt * value
    );

    const anchor = Math.max(...logits);

    const unnormalizedWeights = logits.map(
      value => Math.exp(value - anchor)
    );

    const totalWeight =
      unnormalizedWeights.reduce(
        (total, value) => total + value,
        0
      );

    if (
      !Number.isFinite(totalWeight) ||
      totalWeight <= 0
    ) {
      throw new Error("Invalid probability total");
    }

    return unnormalizedWeights.map(
      value => value / totalWeight
    );
  }

  function calculateMean(weights: number[]): number {
    return population.reduce(
      (total, food, index) =>
        total + food.price * weights[index],
      0
    );
  }

  let baseProbabilities: number[];

  if (
    target === minimumPrice ||
    target === maximumPrice
  ) {
    const countAtTarget = counts.get(target) ?? 1;

    baseProbabilities = population.map(food =>
      food.price === target
        ? 1 / countAtTarget
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

      const middleMean = calculateMean(
        calculateWeights(middleTilt)
      );

      if (middleMean < target) {
        lowTilt = middleTilt;
      } else {
        highTilt = middleTilt;
      }
    }

    baseProbabilities = calculateWeights(
      (lowTilt + highTilt) / 2
    );
  }

  /*
   * Lưu trọng số cơ bản theo giá.
   * Phần choose() sẽ dành riêng 50% cho món Anh Hưng.
   */
  const baseProbabilityMap = new Map<T, number>(
    population.map((food, index) => [
      food,
      baseProbabilities[index]
    ])
  );

  /*
   * Tạo bảng xác suất để các phần khác của ứng dụng
   * có thể đọc và hiển thị.
   */
  const specialMeal = population.find(isSpecialMeal);

  const effectiveProbabilities = new Map<T, number>();

  if (specialMeal && population.length > 1) {
    const otherMeals = population.filter(
      food => food !== specialMeal
    );

    const otherBaseTotal = otherMeals.reduce(
      (total, food) =>
        total +
        (baseProbabilityMap.get(food) ?? 0),
      0
    );

    effectiveProbabilities.set(
      specialMeal,
      SPECIAL_MEAL_PROBABILITY
    );

    if (otherBaseTotal > 0) {
      otherMeals.forEach(food => {
        const baseWeight =
          baseProbabilityMap.get(food) ?? 0;

        effectiveProbabilities.set(
          food,
          (baseWeight / otherBaseTotal) *
            (1 - SPECIAL_MEAL_PROBABILITY)
        );
      });
    } else {
      const probabilityPerMeal =
        (1 - SPECIAL_MEAL_PROBABILITY) /
        otherMeals.length;

      otherMeals.forEach(food => {
        effectiveProbabilities.set(
          food,
          probabilityPerMeal
        );
      });
    }
  } else {
    population.forEach(food => {
      effectiveProbabilities.set(
        food,
        baseProbabilityMap.get(food) ?? 0
      );
    });
  }

  function validateRandomDraw(randomDraw: number): void {
    if (
      !Number.isFinite(randomDraw) ||
      randomDraw < 0 ||
      randomDraw >= 1
    ) {
      throw new Error(
        "Random draw must be in [0,1)"
      );
    }
  }

  function getBaseWeights(items: T[]) {
    if (!items.length) {
      throw new Error("No eligible meals");
    }

    const weights = items.map(food => {
      const probability =
        baseProbabilityMap.get(food);

      if (probability === undefined) {
        throw new Error("Unknown meal");
      }

      return probability;
    });

    return {
      weights,
      totalWeight: weights.reduce(
        (total, weight) => total + weight,
        0
      )
    };
  }

  function getEffectiveWeights(items: T[]) {
    if (!items.length) {
      throw new Error("No eligible meals");
    }

    const eligibleSpecialMeal =
      items.find(isSpecialMeal);

    /*
     * Nếu món Anh Hưng nằm trong danh sách được phép quay,
     * dành đúng 50% trọng số cho món đó.
     */
    if (eligibleSpecialMeal && items.length > 1) {
      const otherMeals = items.filter(
        food => food !== eligibleSpecialMeal
      );

      const {
        weights: otherBaseWeights,
        totalWeight: otherBaseTotal
      } = getBaseWeights(otherMeals);

      const weights = items.map(food => {
        if (food === eligibleSpecialMeal) {
          return SPECIAL_MEAL_PROBABILITY;
        }

        const otherIndex =
          otherMeals.indexOf(food);

        if (otherBaseTotal > 0) {
          return (
            (otherBaseWeights[otherIndex] /
              otherBaseTotal) *
            (1 - SPECIAL_MEAL_PROBABILITY)
          );
        }

        return (
          (1 - SPECIAL_MEAL_PROBABILITY) /
          otherMeals.length
        );
      });

      return {
        weights,
        totalWeight: 1
      };
    }

    /*
     * Nếu chỉ còn duy nhất món Anh Hưng,
     * xác suất món đó là 100%.
     */
    if (eligibleSpecialMeal && items.length === 1) {
      return {
        weights: [1],
        totalWeight: 1
      };
    }

    /*
     * Nếu món Anh Hưng bị tắt hoặc không có trong danh sách,
     * quay theo thuật toán giá thông thường.
     */
    const {
      weights: baseWeights,
      totalWeight: baseTotal
    } = getBaseWeights(items);

    if (baseTotal <= 0) {
      const equalProbability = 1 / items.length;

      return {
        weights: items.map(
          () => equalProbability
        ),
        totalWeight: 1
      };
    }

    const normalizedWeights = baseWeights.map(
      weight => weight / baseTotal
    );

    return {
      weights: normalizedWeights,
      totalWeight: 1
    };
  }

  function chooseFromWeights(
    items: T[],
    weights: number[],
    randomDraw: number
  ): T {
    let remaining = randomDraw;

    for (let index = 0; index < items.length; index++) {
      remaining -= weights[index];

      if (remaining < 0) {
        return items[index];
      }
    }

    /*
     * Xử lý sai số số thực.
     */
    for (
      let index = items.length - 1;
      index >= 0;
      index--
    ) {
      if (weights[index] > 0) {
        return items[index];
      }
    }

    throw new Error("Invalid probability total");
  }

  const expectedPrice = population.reduce(
    (total, food) =>
      total +
      food.price *
        (effectiveProbabilities.get(food) ?? 0),
    0
  );

  return {
    probabilities: effectiveProbabilities,

    expectedPrice,

    meanFor(items: T[]): number {
      const {
        weights,
        totalWeight
      } = getEffectiveWeights(items);

      if (totalWeight <= 0) {
        throw new Error(
          "Eligible meals have no probability"
        );
      }

      return items.reduce(
        (total, food, index) =>
          total +
          food.price *
            (weights[index] / totalWeight),
        0
      );
    },

    choose(
      items: T[],
      random = Math.random
    ): T {
      const randomDraw = random();

      validateRandomDraw(randomDraw);

      const {
        weights,
        totalWeight
      } = getEffectiveWeights(items);

      if (totalWeight <= 0) {
        throw new Error(
          "Eligible meals have no probability"
        );
      }

      const normalizedWeights = weights.map(
        weight => weight / totalWeight
      );

      return chooseFromWeights(
        items,
        normalizedWeights,
        randomDraw
      );
    }
  };
}

export function stopFraction(
  random = Math.random
): number {
  return (
    Math.floor(random() * 81) + 10
  ) / 100;
}

export function priceRarity(
  priceInThousands: number
): number {
  return priceInThousands <= 40
    ? 0
    : priceInThousands <= 65
      ? 1
      : priceInThousands <= 100
        ? 2
        : priceInThousands <= 130
          ? 3
          : 4;
}

/*
 * Hiệu ứng chuyển động độc lập với kết quả món ăn.
 * Các giá trị dưới đây chỉ thay đổi animation.
 */
export function createSpinProfile(
  random = Math.random
) {
  return {
    durationMs:
      7500 + Math.floor(random() * 2001),

    tiles:
      30 + Math.floor(random() * 11),

    friction:
      2.7 + random() * 0.6
  };
}

export function spinProgress(
  progress: number,
  friction: number
): number {
  const normalizedProgress = Math.max(
    0,
    Math.min(1, progress)
  );

  return (
    1 -
    Math.pow(
      1 - normalizedProgress,
      friction
    )
  );
}
