module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === 11000) {
    console.error(
      'Duplicate key:',
      error.keyPattern,
      error.keyValue,
      error.message
    );

    const field = Object.keys(error.keyPattern || {})[0];

    const messages = {
      email: 'อีเมลนี้ถูกใช้แล้ว',
      studentId: 'รหัสนักศึกษานี้ถูกใช้แล้ว',
      code: 'รหัสอุปกรณ์นี้ถูกใช้แล้ว'
    };

    return res.status(409).json({
      error: messages[field] || 'ข้อมูลนี้ถูกใช้แล้ว'
    });
  }

  const status = error.status || 400;
  return res.status(status).json({
    error: error.message || 'เกิดข้อผิดพลาดในระบบ'
  });
};
