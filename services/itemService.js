const Item = require('../models/Item');
const { STOCK_KEYS } = require('../models/Item');

function validateItem(input) {
  if (!input || !['asset', 'supply'].includes(input.kind)) throw new Error('หมวดไม่ถูกต้อง');
  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!code || !name) throw new Error('กรุณากรอกรหัสและชื่ออุปกรณ์');
  const total = Number(input.total);
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('จำนวนทั้งหมดต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  const st = Object.fromEntries(STOCK_KEYS.map((key) => [key, Number(input.st?.[key] ?? 0)]));
  if (STOCK_KEYS.some((key) => !Number.isSafeInteger(st[key]) || st[key] < 0))
    throw new Error('จำนวนในแต่ละสถานะต้องเป็นจำนวนเต็มที่ไม่ติดลบ');
  if (STOCK_KEYS.reduce((sum, key) => sum + st[key], 0) !== total)
    throw new Error('ผลรวมของจำนวนทุกสถานะต้องเท่ากับจำนวนทั้งหมด');
  return {
    kind: input.kind, code, name, cat: String(input.cat || 'ทั่วไป').trim() || 'ทั่วไป',
    total, st, img: typeof input.img === 'string' ? input.img : '',
    desc: typeof input.desc === 'string' ? input.desc.trim() : ''
  };
}

async function listItems({ kind, status, q }) {
  const filter = {};
  if (['asset', 'supply'].includes(kind)) filter.kind = kind;
  if (typeof q === 'string' && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ code: rx }, { name: rx }, { cat: rx }, { desc: rx }];
  }
  const rows = await Item.find(filter).sort({ createdAt: 1 }).lean({ virtuals: true });
  return rows
    .filter((item) => !['ok', 'low', 'out'].includes(status) || item.availability === status)
    .map((item) => ({ ...item, id: String(item._id) }));
}

async function moveStock(id, { from, to, qty, note }) {
  if (!STOCK_KEYS.includes(from) || !STOCK_KEYS.includes(to) || from === to)
    throw new Error('สถานะต้นทางหรือปลายทางไม่ถูกต้อง');
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('จำนวนที่ย้ายต้องเป็นจำนวนเต็มมากกว่า 0');
  const timestamp = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
  const line = `${timestamp} · ${from} → ${to} × ${qty}${note ? ` · ${String(note).slice(0, 160)}` : ''}`;
  const item = await Item.findOneAndUpdate(
    { _id: id, [`st.${from}`]: { $gte: qty } },
    { $inc: { [`st.${from}`]: -qty, [`st.${to}`]: qty }, $push: { log: { $each: [line], $slice: -100 } } },
    { new: true, runValidators: true }
  );
  if (!item) {
    if (!(await Item.exists({ _id: id }))) throw Object.assign(new Error('ไม่พบรายการ'), { status: 404 });
    throw Object.assign(new Error('จำนวนในสถานะต้นทางไม่เพียงพอ'), { status: 409 });
  }
  return item;
}

async function summary(kind) {
  const match = ['asset', 'supply'].includes(kind) ? { kind } : {};
  const [data] = await Item.aggregate([
    { $match: match },
    { $group: { _id: null, itemCount: { $sum: 1 }, total: { $sum: '$total' },
      available: { $sum: '$st.available' }, borrowed: { $sum: '$st.borrowed' },
      broken: { $sum: '$st.broken' }, damaged: { $sum: '$st.damaged' }, lost: { $sum: '$st.lost' } } }
  ]);
  return data || { itemCount: 0, total: 0, available: 0, borrowed: 0, broken: 0, damaged: 0, lost: 0 };
}

module.exports = { validateItem, listItems, moveStock, summary };
