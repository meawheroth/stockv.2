module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ error: 'รหัสรายการนี้ถูกใช้แล้ว' });
  const status = error.status || 400;
  res.status(status).json({ error: error.message || 'เกิดข้อผิดพลาดในระบบ' });
};
