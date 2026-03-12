const db = require("../database/connection");
const { logPaymentEvent } = require("./paymentServices");

const createOrder = async (data, user) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of data.items) {
      const productResult = await client.query(
        `SELECT id, title, price, stock, status
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [item.product_id]
      );

      if (productResult.rowCount === 0) {
        const error = new Error("Produto não encontrado");
        error.statusCode = 400;
        throw error;
      }

      const product = productResult.rows[0];

      if (product.status !== "active") {
        const error = new Error(
          `Produto ${product.title} não está disponível.`
        );
        error.statusCode = 400;
        throw error;
      }

      if (product.stock < item.quantity) {
        const error = new Error("Estoque insuficiente");
        error.statusCode = 400;
        throw error;
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.title,
        unit_price: product.price,
        quantity: item.quantity
      });
    }

    const orderResult = await client.query(
      `INSERT INTO orders
       (buyer_id, status, total_amount, expires_at)
       VALUES ($1, 'pending', $2, NOW() + INTERVAL '15 minutes')
       RETURNING *`,
      [user.userId, totalAmount]
    );

    const order = orderResult.rows[0];

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, quantity, unit_price, product_name_snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.product_name
        ]
      );

      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query("COMMIT");
    return order;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const cleanupExpiredOrders = async () => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const expiredOrdersResult = await client.query(
      `SELECT id
       FROM orders
       WHERE status = 'pending'
       AND expires_at < NOW()
       FOR UPDATE`
    );

    let cleanedCount = 0;

    for (const order of expiredOrdersResult.rows) {

      // 🔹 1️⃣ Devolver estoque
      const itemsResult = await client.query(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1`,
        [order.id]
      );

      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE products
           SET stock = stock + $1
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // 🔹 2️⃣ Atualizar pagamentos pendentes
      const expiredPayments = await client.query(
        `SELECT id
         FROM payments
         WHERE order_id = $1
         AND status = 'pending'`,
        [order.id]
      );

      await client.query(
        `UPDATE payments
         SET status = 'rejected',
             error_message = 'Pagamento expirado automaticamente',
             processed_at = NOW()
         WHERE order_id = $1
         AND status = 'pending'`,
        [order.id]
      );

      // 🔹 3️⃣ Registrar log de expiração
      for (const payment of expiredPayments.rows) {
        await logPaymentEvent(client, {
          paymentId: payment.id,
          eventType: "PAYMENT_EXPIRED",
          status: "rejected",
          message: "Pagamento expirado automaticamente pelo sistema"
        });
      }

      // 🔹 4️⃣ Cancelar order
      await client.query(
        `UPDATE orders
         SET status = 'cancelled'
         WHERE id = $1`,
        [order.id]
      );

      cleanedCount++;
    }

    await client.query("COMMIT");
    return { cleaned: cleanedCount };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getOrderCheckoutSummary = async (orderId, buyerId) => {
  const result = await db.query(
    `SELECT id, buyer_id, status, total_amount, expires_at
     FROM orders
     WHERE id = $1`,
    [orderId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Pedido nao encontrado");
    error.statusCode = 404;
    throw error;
  }

  const order = result.rows[0];

  if (String(order.buyer_id) !== String(buyerId)) {
    const error = new Error("Acesso negado a este pedido");
    error.statusCode = 403;
    throw error;
  }

  return {
    id: order.id,
    status: order.status,
    total_amount: order.total_amount,
    expires_at: order.expires_at
  };
};

const cancelAllPendingOrdersForBuyer = async (buyerId) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const pendingOrdersResult = await client.query(
      `SELECT id
       FROM orders
       WHERE buyer_id = $1
         AND status = 'pending'
       FOR UPDATE`,
      [buyerId]
    );

    let cancelled = 0;

    for (const order of pendingOrdersResult.rows) {
      const itemsResult = await client.query(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1`,
        [order.id]
      );

      for (const item of itemsResult.rows) {
        await client.query(
          `UPDATE products
           SET stock = stock + $1
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      const pendingPayments = await client.query(
        `SELECT id
         FROM payments
         WHERE order_id = $1
           AND status = 'pending'`,
        [order.id]
      );

      await client.query(
        `UPDATE payments
         SET status = 'rejected',
             error_message = 'Pedido cancelado pelo comprador',
             processed_at = NOW()
         WHERE order_id = $1
           AND status = 'pending'`,
        [order.id]
      );

      for (const payment of pendingPayments.rows) {
        await logPaymentEvent(client, {
          paymentId: payment.id,
          eventType: "PAYMENT_REJECTED",
          status: "rejected",
          message: "Pagamento rejeitado por cancelamento do pedido pelo comprador"
        });
      }

      await client.query(
        `UPDATE orders
         SET status = 'cancelled'
         WHERE id = $1`,
        [order.id]
      );

      cancelled++;
    }

    await client.query("COMMIT");
    return { cancelled };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getBuyerOrdersSummary = async (buyerId) => {
  const result = await db.query(
    `
    SELECT
      o.id,
      o.status,
      o.total_amount,
      o.expires_at,
      COALESCE(
        STRING_AGG(DISTINCT oi.product_name_snapshot, ' | '),
        ''
      ) AS product_name,
      COALESCE(
        STRING_AGG(DISTINCT pr.description, ' | '),
        ''
      ) AS product_description
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products pr ON pr.id = oi.product_id
    WHERE o.buyer_id = $1
    GROUP BY o.id, o.status, o.total_amount, o.expires_at
    ORDER BY o.expires_at DESC
    `,
    [buyerId]
  );

  return result.rows;
};

module.exports = {
  createOrder,
  cleanupExpiredOrders,
  getOrderCheckoutSummary,
  cancelAllPendingOrdersForBuyer,
  getBuyerOrdersSummary
};
