import { WaterCollection } from "../models/water.js";

export const createWater = async (payload) => {
  let { amount, date, norm, userId, userNorm } = payload;

  if (!norm) {
    norm = userNorm;
  }

  const percentage = ((amount / (norm * 1000)) * 100).toFixed(2);
  const water = await WaterCollection.create({
    amount,
    date,
    norm,
    percentage,
    owner: userId,
  });

  const { _id, owner, ...other } = water._doc;
  const data = { id: _id, ...other };
  return data;
};

export const getWaterById = async (waterId, userId) => {
  return await WaterCollection.findOne(
    { _id: waterId, owner: userId },
    "-_id -owner"
  );
};

export const updateWaterById = async (waterId, userId, payload) => {
  const water = await WaterCollection.findOne({ _id: waterId, owner: userId });

  if (!water) return null;

  const {
    amount = water.amount,
    date = water.date,
    norm = water.norm,
  } = payload;

  if (typeof amount !== "number" || typeof norm !== "number") {
    throw new Error("Invalid payload: 'amount' and 'norm' must be numbers");
  }

  const percentage = ((amount / (norm * 1000)) * 100).toFixed(2);

  const updatedWater = await WaterCollection.findOneAndUpdate(
    { _id: waterId, owner: userId },
    { amount, date, norm, percentage },
    { new: true }
  );

  if (!updatedWater) return null;

  const { _id, owner, ...other } = updatedWater.toObject();
  return { id: _id, ...other };
};

export const deleteWaterById = async (waterId, userId) => {
  const water = await WaterCollection.findOneAndDelete({
    _id: waterId,
    owner: userId,
  });

  if (!water) return null;

  const { _id, owner, ...other } = water._doc;
  const data = { id: _id, ...other };
  return data;
};

export const getWaterPrDay = async (userId, timestamp) => {
  const date = new Date(parseInt(timestamp));

  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0o0, 0o0, 0o0, 0o0);

  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const startOfDayTimestamp = startOfDay.getTime();
  const endOfDayTimestamp = endOfDay.getTime();

  const PerDay = await WaterCollection.find({
    owner: userId,
    date: {
      $gte: startOfDayTimestamp,
      $lte: endOfDayTimestamp,
    },
  }).lean();

  if (!PerDay || PerDay.length === 0) {
    return {
      value: [],
      totalAmount: 0,
      totalPercentage: 0,
    };
  }

  const value = PerDay.map(({ _id, owner, ...rest }) => {
    return { id: _id, ...rest };
  });

  const totalAmount = PerDay.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPercentage = parseFloat(
    PerDay.reduce((acc, curr) => acc + curr.percentage, 0).toFixed(2)
  );

  return {
    value,
    totalAmount,
    totalPercentage,
  };
};

// Функція для обчислення початку і кінця тижня
const getWeekRange = (date) => {
  const firstDayOfWeek = new Date(date);
  firstDayOfWeek.setUTCHours(0o0, 0o0, 0o0, 0o0);
  firstDayOfWeek.setUTCDate(date.getUTCDate() - 6); // Обчислюємо дату шість днів назад

  const lastDayOfWeek = new Date(date); // Встановлюємо кінцеву дату як передану дату
  lastDayOfWeek.setUTCHours(23, 59, 59, 999);

  return { firstDayOfWeek, lastDayOfWeek };
};

export const getWaterPrWeek = async (userId, timestamp) => {
  const date = new Date(parseInt(timestamp));

  // Отримуємо початок і кінець тижня
  const { firstDayOfWeek, lastDayOfWeek } = getWeekRange(date);

  // Конвертуємо в Unix timestamp
  const startOfDayOfWeekTimestamp = Math.floor(firstDayOfWeek.getTime());
  const endOfDayOfWeekTimestamp = Math.floor(lastDayOfWeek.getTime());

  // Знаходимо записи для даного користувача за тиждень
  const perDay = await WaterCollection.find({
    owner: userId,
    date: {
      $gte: startOfDayOfWeekTimestamp,
      $lte: endOfDayOfWeekTimestamp,
    },
  }).lean();

  // Якщо немає записів, повертаємо порожні значення
  if (!perDay || perDay.length === 0) {
    // Формуємо масив результатів з порожніми значеннями
    const result = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(firstDayOfWeek);
      day.setUTCDate(firstDayOfWeek.getUTCDate() + i);
      return {
        date: day.getTime().toString(),
        amount: 0,
        percentage: 0,
      };
    });

    return { result, length: result.length };
  }

  // Групуємо записи за днями
  const groupedByDate = {};
  perDay.forEach(({ date, amount, percentage }) => {
    const day = new Date(parseInt(date)).getUTCDate();
    if (!groupedByDate[day]) {
      groupedByDate[day] = {
        amount: 0,
        date: date,
        percent: 0,
      };
    }
    groupedByDate[day].amount += amount;
    groupedByDate[day].percent += percentage; // Додаємо відсоток для кожного прийому
  });

  // Формуємо масив результатів на основі кількості днів у тижні
  const result = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(firstDayOfWeek);
    day.setUTCDate(firstDayOfWeek.getUTCDate() + i);
    const dayDate = day.getUTCDate();
    const dayData = groupedByDate[dayDate] || {
      amount: 0,
      date: day.getTime(),
      percent: 0,
    };
    return {
      date: dayData.date.toString(),
      amount: dayData.amount,
      percentage: parseFloat(dayData.percent.toFixed(2)),
    };
  });

  return { result, length: result.length };
};

// Функція для отримання останнього дня місяця з урахуванням високосного року
const getLastDayOfMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

export const getWaterPrMonth = async (userId, timestamp) => {
  const date = new Date(parseInt(timestamp));
  // Отримуємо перший день місяця
  const firstDayOfMonth = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    1
  );

  // Отримуємо останній день місяця з урахуванням високосного року
  const lastDayOfMonth = getLastDayOfMonth(
    date.getUTCFullYear(),
    date.getUTCMonth()
  );

  // Конвертуємо в Unix timestamp
  const startOfDayOfMonthTimestamp = Math.floor(firstDayOfMonth.getTime());
  const endOfDayOfMonthTimestamp = Math.floor(
    new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      lastDayOfMonth
    ).getTime()
  );

  // Знаходимо записи для даного користувача за місяць
  const perDay = await WaterCollection.find({
    owner: userId,
    date: {
      $gte: startOfDayOfMonthTimestamp,
      $lte: endOfDayOfMonthTimestamp,
    },
  }).lean();

  // Якщо немає записів, повертаємо порожні значення
  if (!perDay || perDay.length === 0) {
    // Формуємо масив результатів з порожніми значеннями
    const result = Array.from({ length: lastDayOfMonth }, (_, i) => {
      const day = i + 1;
      return {
        date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day))
          .getTime()
          .toString(),
        amount: 0,
        percentage: 0,
      };
    });

    return { result, length: result.length };
  }

  // Групуємо записи за днями
  const groupedByDate = {};
  perDay.forEach(({ date, amount, percentage }) => {
    const day = new Date(parseInt(date)).getUTCDate();
    if (!groupedByDate[day]) {
      groupedByDate[day] = {
        amount: 0,
        date: date,
        percent: 0,
      };
    }
    groupedByDate[day].amount += amount;
    groupedByDate[day].percent += percentage; // Додаємо відсоток для кожного прийому
  });

  // Формуємо масив результатів на основі кількості днів у місяці
  const result = Array.from({ length: lastDayOfMonth }, (_, i) => {
    const day = i + 1;
    const dayData = groupedByDate[day] || {
      amount: 0,
      date: new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day)
      ).getTime(),
      percent: 0,
    };
    return {
      date: dayData.date.toString(),
      amount: dayData.amount,
      percentage: parseFloat(dayData.percent.toFixed(2)),
    };
  });

  return { result, length: result.length };
};
