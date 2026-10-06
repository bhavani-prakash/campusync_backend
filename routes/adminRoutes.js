const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAdminReports,
  updateReportStatus,
  suspendUser,
  banUser,
  unbanUser,
  deleteInappropriateMessage,
} = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect, requireAdmin);

router.get('/admin/dashboard', getDashboardStats);
router.get('/admin/reports', getAdminReports);
router.put('/admin/reports/:id', updateReportStatus);
router.put('/admin/users/:id/suspend', suspendUser);
router.put('/admin/users/:id/ban', banUser);
router.put('/admin/users/:id/unban', unbanUser);
router.delete('/admin/messages/:id', deleteInappropriateMessage);

module.exports = router;
