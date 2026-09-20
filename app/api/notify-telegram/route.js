import { NextResponse } from "next/server";

// อ่านค่า config จาก Environment Variables ฝั่ง Server เท่านั้น
// (ไม่มี prefix NEXT_PUBLIC_ ดังนั้นจะไม่ถูก bundle ไปฝั่ง browser)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5; // เกณฑ์แจ้งเตือนสต๊อกเหลือน้อย

// สร้างข้อความแจ้งเตือน "มีรายการขายใหม่"
function buildNewOrderMessage({ productName, quantity, totalPrice, stockAfter, unit }) {
  const timeStr = new Date().toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    `🛍️ <b>มีรายการขายใหม่!</b>\n` +
    `- สินค้า: ${productName}\n` +
    `- จำนวน: ${quantity} ${unit || "ชิ้น"}\n` +
    `- ราคารวม: ${Number(totalPrice).toFixed(2)} บาท\n` +
    `- สต๊อกคงเหลือปัจจุบัน: ${stockAfter} ชิ้น\n` +
    `- เวลา: ${timeStr}`
  );
}

// สร้างข้อความแจ้งเตือน "สต๊อกใกล้หมด"
function buildLowStockMessage({ productName, stockAfter }) {
  return (
    `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
    `- สินค้า: ${productName}\n` +
    `- คงเหลือเพียง: ${stockAfter} ชิ้น\n` +
    `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
  );
}

// ยิงข้อความไปยัง Telegram Bot API
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${errBody}`);
  }
}

// POST /api/notify-telegram
// รับข้อมูล order ดิบจาก client แล้ว route เป็นคนสร้าง + ส่งข้อความเอง
export async function POST(request) {
  // ถ้า config ไม่ครบ ก็แค่แจ้งกลับไป ไม่ throw ให้ระบบขายพัง
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram config ไม่ครบ (BOT_TOKEN / CHAT_ID) - ข้ามการแจ้งเตือน");
    return NextResponse.json(
      { ok: false, skipped: true, reason: "missing telegram config" },
      { status: 200 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const { productName, quantity, totalPrice, stockAfter, unit } = body || {};

  if (!productName || quantity == null || totalPrice == null || stockAfter == null) {
    return NextResponse.json(
      { ok: false, error: "missing required order fields" },
      { status: 400 }
    );
  }

  const orderData = { productName, quantity, totalPrice, stockAfter, unit };

  try {
    // งานที่ 1: แจ้งเตือนรายการขายใหม่ (ส่งเสมอ)
    await sendTelegramMessage(buildNewOrderMessage(orderData));

    // งานที่ 2: ถ้าสต๊อกหลังตัด <= เกณฑ์ ให้ยิงข้อความเตือนภัยแยกอีกก้อน
    if (stockAfter <= LOW_STOCK_THRESHOLD) {
      await sendTelegramMessage(buildLowStockMessage(orderData));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // จับ error ไว้ที่นี่ ส่ง response กลับแบบ 200 พร้อม ok:false
    // เพื่อให้ฝั่ง client ตัดสินใจเองว่าจะ ignore หรือ log ต่อ โดยไม่ throw ทำให้ route พัง
    console.error("ส่ง Telegram แจ้งเตือนไม่สำเร็จ:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}
