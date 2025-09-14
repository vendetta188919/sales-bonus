/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   const { discount = 0, sale_price, quantity = 1 } = purchase;
   const discountDecimal = discount / 100;
   const fullPrice = sale_price * quantity;
   const revenue = fullPrice * (1 - discountDecimal);
   return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;

    if (profit === undefined || profit === null) {
        return 0;
    }

    let bonusPercentage;
    if (index === 0) {
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        bonusPercentage = 0.10;
    } else if (index === total - 1) {
        bonusPercentage = 0;
    } else {
        bonusPercentage = 0.05;
    }

    const bonus = profit * bonusPercentage;
    return bonus;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // Проверка наличия опций
    if (!options || typeof options !== 'object') {
        throw new Error('Опции должны быть объектом');
    }

    const { calculateRevenue, calculateBonus } = options;

    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Не хватает необходимых функций в опциях');
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
        items: []
    }));

    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(seller => [seller.seller_id, seller])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];

        if (!seller) {
            return;
        }

        seller.sales_count += 1;
        seller.revenue += record.total_amount;

        record.items.forEach(item => {
            const product = productIndex[item.sku];

            if (!product) {
                return;
            }

            // Посчитать выручку с учетом скидки
            const revenue = calculateRevenue(item, product);

            // Посчитать себестоимость товара
            const cost = product.purchase_price * (item.quantity || 1);

            // Посчитать прибыль: выручка минус себестоимость
            const profit = revenue - cost;
            seller.profit += profit;

            // Учет количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity || 1;

            seller.items.push({
                sku: item.sku,
                revenue: revenue,
                profit: profit,
                quantity: item.quantity || 1
            });
        });
    });

    // Сортировка продавцов по прибыли
    const sortedSellers = sellerStats.sort((a, b) => b.profit - a.profit);
    const totalSellers = sortedSellers.length;

    // Назначение премий на основе ранжирования
    sortedSellers.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
        
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Подготовка итоговой коллекции с нужными полями
    return sortedSellers.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}