import { Link, Route, Routes } from "react-router-dom";
import AdminProtectedLayout from "./components/AdminProtectedLayout";
import { useMemo, useState } from "react";
import FloatingNav from "./components/FloatingNav";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailsPage from "./pages/ProductDetailsPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import InvoicePage from "./pages/InvoicePage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEquipmentPage from "./pages/admin/AdminEquipmentPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminReceivablesPage from "./pages/admin/AdminReceivablesPage";
import AdminPackagesPage from "./pages/admin/AdminPackagesPage";
import CustomerAccountPage from "./pages/CustomerAccountPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CreateAccountPage from "./pages/CreateAccountPage";

export default function App() {
  const [cart, setCart] = useState([]);
  const [booking, setBooking] = useState({ rentalDate: "", startTime: "", endTime: "", durationHours: 4 });

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  return (
    <div className="app-shell">
      <FloatingNav cartCount={cartCount} />

      <main className="mx-auto mt-4 max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage cart={cart} setCart={setCart} booking={booking} setBooking={setBooking} />} />
          <Route path="/products" element={<ProductsPage cart={cart} setCart={setCart} booking={booking} setBooking={setBooking} />} />
          <Route path="/products/:id" element={<ProductDetailsPage cart={cart} setCart={setCart} booking={booking} setBooking={setBooking} />} />
          <Route path="/cart" element={<CartPage cart={cart} setCart={setCart} booking={booking} />} />
          <Route path="/checkout" element={<CheckoutPage cart={cart} setCart={setCart} booking={booking} />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/invoices/:id" element={<InvoicePage />} />
          <Route path="/create-account" element={<CreateAccountPage />} />
          <Route path="/account" element={<CustomerAccountPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminProtectedLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
            <Route path="/admin/packages" element={<AdminPackagesPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/receivables" element={<AdminReceivablesPage />} />
          </Route>
        </Routes>
      </main>

      <footer className="app-footer mt-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="footer-heading">Kids Party Rentals</p>
            <p className="footer-copy mt-2">Bounce houses, slides, concessions, and party essentials.</p>
          </div>
          <div>
            <p className="footer-heading">Service Areas</p>
            <p className="footer-copy mt-2">Lakewood</p>
            <p className="footer-copy">Toms River</p>
            <p className="footer-copy">Jackson</p>
            <p className="footer-copy">Howell</p>
          </div>
          <div>
            <p className="footer-heading">Quick Links</p>
            <div className="mt-2 flex flex-col gap-1.5">
              <Link to="/products" className="footer-link">
                Rentals
              </Link>
              <Link to="/checkout" className="footer-link">
                Book Now
              </Link>
              <Link to="/account" className="footer-link">
                My Account
              </Link>
            </div>
          </div>
          <div>
            <p className="footer-heading">Contact</p>
            <p className="mt-2">
              <a href="mailto:info@simchapro.com" className="footer-link">
                info@simchapro.com
              </a>
            </p>
            <p className="mt-1.5">
              <a href="tel:+18482076312" className="footer-link">
                (848) 207-6312
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
