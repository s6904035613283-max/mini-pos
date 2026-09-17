"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HomePage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });

  // สถานะแถวที่กำลังแก้ไข (inline edit)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  // ดึงรายการสินค้าจาก Supabase
  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setProducts(data);
      setError("");
    }
    setLoading(false);
  }

  // จัดการค่าฟอร์มเพิ่มสินค้า
  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // เพิ่มสินค้าใหม่
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price) {
      setError("กรุณากรอก SKU, ชื่อสินค้า และราคาให้ครบ");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: form.stock ? parseInt(form.stock, 10) : 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setForm({ sku: "", name: "", price: "", stock: "", unit: "" });
      setError("");
      fetchProducts();
    }
  }

  // ลบสินค้า
  async function handleDelete(id) {
    if (!confirm("ยืนยันการลบสินค้านี้?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      fetchProducts();
    }
  }

  // เริ่มแก้ไขแถว
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  // บันทึกการแก้ไข
  async function saveEdit(id) {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      cancelEdit();
      fetchProducts();
    }
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {error && <p className="error">{error}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct} className="form-row">
          <input
            type="text"
            name="sku"
            placeholder="SKU"
            value={form.sku}
            onChange={handleFormChange}
          />
          <input
            type="text"
            name="name"
            placeholder="ชื่อสินค้า"
            value={form.name}
            onChange={handleFormChange}
          />
          <input
            type="number"
            name="price"
            placeholder="ราคา"
            value={form.price}
            onChange={handleFormChange}
            step="0.01"
          />
          <input
            type="number"
            name="stock"
            placeholder="คงเหลือ"
            value={form.stock}
            onChange={handleFormChange}
          />
          <input
            type="text"
            name="unit"
            placeholder="หน่วย"
            value={form.unit}
            onChange={handleFormChange}
          />
          <button type="submit">เพิ่มสินค้า</button>
        </form>
      </div>

      {/* ตารางรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                {editingId === product.id ? (
                  // โหมดแก้ไข inline
                  <>
                    <td>
                      <input
                        type="text"
                        name="sku"
                        value={editForm.sku}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="price"
                        value={editForm.price}
                        onChange={handleEditChange}
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="stock"
                        value={editForm.stock}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="unit"
                        value={editForm.unit}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <button onClick={() => saveEdit(product.id)}>บันทึก</button>{" "}
                      <button onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  // โหมดแสดงผลปกติ
                  <>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.price}</td>
                    <td>{product.stock}</td>
                    <td>{product.unit}</td>
                    <td>
                      <button onClick={() => startEdit(product)}>แก้ไข</button>{" "}
                      <button onClick={() => handleDelete(product.id)}>ลบ</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6}>ยังไม่มีสินค้าในระบบ</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
