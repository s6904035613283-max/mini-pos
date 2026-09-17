import './globals.css';

export const metadata = {
  title: 'Mini POS',
  description: 'ระบบขายของร้านเล็ก',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <nav className="navbar">
          <div className="navbar-brand">Mini POS</div>
          <div className="navbar-links">
            <a href="/">สินค้า</a>
            <a href="/sell">ขายสินค้า</a>
            <a href="/history">ประวัติการขาย</a>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
