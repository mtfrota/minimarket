const express = require("express");
const router = express.Router();
const { verifyTokenMiddleware } = require("../middlewares/authMiddleware");
const { register, login, refresh, me, updateMe, logout } = require("../controllers/authController");
const { requireRole } = require("../middlewares/roleMiddleware");

router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/register", register);
router.post("/login", login);

router.get("/me", verifyTokenMiddleware, me);
router.patch("/me", verifyTokenMiddleware, updateMe);
router.get(
    "/admin-test",
    verifyTokenMiddleware,
    requireRole("admin"),
    (req, res) => {
        res.json({ message: "Você é admin" });
    }
);


module.exports = router;
