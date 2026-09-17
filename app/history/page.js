"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function HistoryPage() {
  // รายการประวัติการขายทั้งหมด
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSales();
  }, []);

  // ดึงข้อมูลจากตาราง sales เรียงล่าสุดไปเก่าสุด
  async function fetchSales() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("sold_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setSales(data);
      setError("");
    }
    setLoading(false);
  }

  // จัดรูปแบบวันเวลาให้อ่านง่าย
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // คำนวณยอดขายรวมทั้งหมด
  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.total_price || 0),
    0
  );

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {error && <p className="error">{error}</p>}

      {/* สรุปยอดขายรวม */}
      <div className="card">
        <h2>ยอดขายรวมทั้งหมด: {totalSales.toFixed(2)} บาท</h2>
      </div>

      {/* ตารางประวัติการขาย */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.sold_at)}</td>
                <td>{sale.product_name}</td>
                <td>{sale.quantity}</td>
                <td>{Number(sale.total_price).toFixed(2)}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4}>ยังไม่มีประวัติการขาย</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
