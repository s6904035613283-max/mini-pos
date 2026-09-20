"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ---- Telegram Config (อ่านจาก Environment Variables) ----
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
const LOW_STOCK_THRESHOLD = 5; // เกณฑ์แจ้งเตือนสต๊อกเหลือน้อย

// ส่งข้อความแจ้งเตือนไปยัง Telegram
// ทำงานแบบ async/try-catch แยกต่างหาก ไม่ทำให้ flow การขายพัง ถ้ายิงไม่สำเร็จ
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram config ไม่ครบ (BOT_TOKEN / CHAT_ID) - ข้ามการแจ้งเตือน");
    return;
  }

  try {
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
      console.error("Telegram API error:", res.status, errBody);
    }
  } catch (err) {
    // จับ error ไว้เฉยๆ ไม่ throw ต่อ เพื่อไม่ให้กระทบระบบขาย
    console.error("ส่ง Telegram แจ้งเตือนไม่สำเร็จ:", err);
  }
}

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
    `- ราคารวม: ${totalPrice.toFixed(2)} บาท\n` +
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

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มการขาย
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  // ดึงรายการสินค้าจาก Supabase
  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError("");
    }
    setLoading(false);
  }

  // หาข้อมูลสินค้าที่เลือกอยู่ปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวมอัตโนมัติ
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function resetForm() {
    setSelectedProductId("");
    setQuantity("");
  }

  // ยืนยันการขาย
  async function handleSell(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProductId) {
      setError("กรุณาเลือกสินค้า");
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setError("กรุณากรอกจำนวนที่ถูกต้อง");
      return;
    }
    if (!selectedProduct) {
      setError("ไม่พบข้อมูลสินค้า");
      return;
    }

    // ตรวจสอบ stock คงเหลือ
    if (qtyNumber > selectedProduct.stock) {
      setError(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1. บันทึกรายการลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setError(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2. อัปเดต stock ในตาราง products ให้ลดลง
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    // ---- 3. แจ้งเตือน Telegram (ไม่บล็อก flow การขาย ถ้า error ก็ปล่อยผ่าน) ----
    const notifyPayload = {
      productName: selectedProduct.name,
      quantity: qtyNumber,
      totalPrice: totalPrice,
      stockAfter: newStock,
      unit: selectedProduct.unit,
    };

    // งานที่ 1: แจ้งเตือนรายการขายใหม่ (ยิงแบบ async ไม่ await ให้บล็อก UI หลัก)
    sendTelegramMessage(buildNewOrderMessage(notifyPayload));

    // งานที่ 2: ถ้าสต๊อกหลังตัด <= เกณฑ์ ให้ยิงข้อความเตือนภัยแยกอีกก้อน
    if (newStock <= LOW_STOCK_THRESHOLD) {
      sendTelegramMessage(buildLowStockMessage(notifyPayload));
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และรีเฟรชรายการสินค้า
    setSuccess(
      `ขาย "${selectedProduct.name}" จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (รวม ${totalPrice.toFixed(2)} บาท)`
    );
    resetForm();
    await fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดข้อมูลสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              {/* Dropdown เลือกสินค้า */}
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.price} บาท) - คงเหลือ {product.stock}
                  </option>
                ))}
              </select>

              {/* ช่องกรอกจำนวน */}
              <input
                type="number"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />

              <button type="submit" disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : "ขาย"}
              </button>
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            {selectedProduct && qtyNumber > 0 && (
              <p>
                ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong> (
                {selectedProduct.price} x {qtyNumber})
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
