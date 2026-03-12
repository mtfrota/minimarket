const cron = require("node-cron");
const { cleanupExpiredOrders } = require("../services/orderServices");

const startCleanupJob = () => {
    cron.schedule("* * * * *", async () => {
        try {
            const result = await cleanupExpiredOrders();
            if (result.cleaned > 0) {
                console.log(`Cleanup executado. Pedidos cancelados: ${result.cleaned}`);
            }
        } catch (error) {
            console.error("Erro de cleanup automático:", error.message);
        }
    });
};

module.exports = { startCleanupJob };