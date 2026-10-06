const router = require('express').Router();
const Item = require('../models/Item');
const { validateItem, listItems, moveStock, summary } = require('../services/itemService');
const { signedIn, allowRoles } = require('../middleware/auth');

const endpoint = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

router.get('/summary', signedIn, endpoint(async (req, res) => res.json(await summary(req.query.kind))));
router.get('/', signedIn, endpoint(async (req, res) => res.json(await listItems(req.query))));
router.get('/:id/history', signedIn, endpoint(async (req, res) => {
  const item = await Item.findById(req.params.id).select('code name log updatedAt');
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการ' });
  res.json({ id: item.id, code: item.code, name: item.name, updatedAt: item.updatedAt, entries: item.log.slice().reverse() });
}));
router.post('/', signedIn, allowRoles('admin'), endpoint(async (req, res) => res.status(201).json(await Item.create(validateItem(req.body)))));
router.put('/:id', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  const current = await Item.findById(req.params.id);
  if (!current) return res.status(404).json({ error: 'ไม่พบรายการ' });
  const data = validateItem(req.body);
  if (current.st.borrowed > 0 && (
    data.kind !== current.kind || data.total !== current.total ||
    Object.keys(current.st.toObject()).some((key) => data.st[key] !== current.st[key])
  )) return res.status(409).json({ error: 'แก้ยอดหรือหมวดอุปกรณ์ไม่ได้ขณะที่ยังมีรายการยืมค้าง กรุณารับคืนให้ครบก่อน' });
  const item = await Item.findOneAndUpdate(
    { _id: req.params.id, 'st.borrowed': current.st.borrowed }, data, { new: true, runValidators: true }
  );
  if (!item) return res.status(409).json({ error: 'ยอดอุปกรณ์เปลี่ยนระหว่างบันทึก กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง' });
  res.json(item);
}));
router.post('/:id/move', signedIn, allowRoles('admin'), endpoint(async (req, res) => res.json(await moveStock(req.params.id, {
  from: req.body.from, to: req.body.to, qty: Number(req.body.qty), note: req.body.note
}))));
router.delete('/:id', signedIn, allowRoles('admin'), endpoint(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการ' });
  if (item.st.borrowed > 0) return res.status(409).json({ error: 'ยังมีจำนวนถูกยืมอยู่ จึงลบรายการไม่ได้' });
  await item.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
