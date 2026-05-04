import { Link, Route, Routes } from "react-router-dom";
import AdminProtectedLayout from "./components/AdminProtectedLayout";
import { useMemo, useState } from "react";
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
import CustomerAccountPage from "./pages/CustomerAccountPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CreateAccountPage from "./pages/CreateAccountPage";

export default function App() {
  const [cart, setCart] = useState([]);
  const [booking, setBooking] = useState({ rentalDate: "", startTime: "", endTime: "" });

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl tracking-tight text-white drop-shadow-sm">
            Kids Party Rentals
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Link to="/products" className="nav-link-main">
              Products
            </Link>
            <Link to="/cart" className="nav-link-main">
              Cart ({cartCount})
            </Link>
            <Link to="/create-account" className="nav-link-main">
              Sign up
            </Link>
            <Link to="/account" className="nav-link-main">
              Account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
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
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/receivables" element={<AdminReceivablesPage />} />
          </Route>
        </Routes>
      </main>

      <footer className="app-footer mt-8">
        <div className="mx-auto max-w-6xl px-4 py-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-bold text-slate-900">Kids Party Rentals</p>
            <p className="mt-2 text-slate-600">Bounce houses, slides, concessions, and party essentials.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Service Areas</p>
            <p className="mt-2 text-slate-600">Lakewood</p>
            <p className="text-slate-600">Toms River</p>
            <p className="text-slate-600">Jackson</p>
            <p className="text-slate-600">Howell</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Quick Links</p>
            <div className="mt-2 flex flex-col gap-1">
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
            <p className="font-semibold text-slate-900">Contact</p>
            <p className="mt-2 text-slate-600">support@example.com</p>
            <p className="text-slate-600">(732) 000-0000</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
