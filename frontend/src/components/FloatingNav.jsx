import { useEffect, useState } from "react";
import { Home, Package2, Settings2, ShoppingCart, UserCircle2, UserPlus2 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ADMIN_SESSION_EVENT,
  CUSTOMER_SESSION_EVENT,
  isCustomerSessionToken,
  shouldShowAdminNav
} from "../adminSession";

function useShowAdminLink() {
  const location = useLocation();
  const read = () => shouldShowAdminNav();
  const [show, setShow] = useState(read);

  useEffect(() => {
    setShow(read());
  }, [location.pathname, location.key]);

  useEffect(() => {
    const sync = () => setShow(read());
    window.addEventListener("storage", sync);
    window.addEventListener(ADMIN_SESSION_EVENT, sync);
    window.addEventListener(CUSTOMER_SESSION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ADMIN_SESSION_EVENT, sync);
      window.removeEventListener(CUSTOMER_SESSION_EVENT, sync);
    };
  }, []);
  return show;
}

function useCustomerLoggedIn() {
  const location = useLocation();
  const read = () => isCustomerSessionToken(localStorage.getItem("customerToken"));
  const [loggedIn, setLoggedIn] = useState(read);

  useEffect(() => {
    setLoggedIn(read());
  }, [location.pathname, location.key]);

  useEffect(() => {
    const sync = () => setLoggedIn(read());
    window.addEventListener("storage", sync);
    window.addEventListener(CUSTOMER_SESSION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CUSTOMER_SESSION_EVENT, sync);
    };
  }, []);
  return loggedIn;
}

export default function FloatingNav({ cartCount }) {
  const showAdminLink = useShowAdminLink();
  const customerLoggedIn = useCustomerLoggedIn();
  const navItems = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/products", label: "Products", icon: Package2 },
    { to: "/cart", label: "Cart", icon: ShoppingCart, showBadge: true },
    ...(!customerLoggedIn ? [{ to: "/create-account", label: "Sign up", icon: UserPlus2, end: true }] : []),
    { to: "/account", label: "Account", icon: UserCircle2, end: true }
  ];

  return (
    <header className="floating-nav-wrap">
      <nav className="floating-nav">
        {navItems.map(({ to, label, icon: Icon, end, showBadge }) => (
          <NavLink key={to} to={to} end={end} className="nav-link-main">
            <span className="nav-link-icon-wrap">
              <Icon size={16} strokeWidth={2.2} />
              {showBadge ? <span className="nav-cart-badge">{cartCount}</span> : null}
            </span>
            <span className="nav-link-label">{label}</span>
          </NavLink>
        ))}
        {showAdminLink ? (
          <NavLink to="/admin/dashboard" className="nav-link-main">
            <span className="nav-link-icon-wrap">
              <Settings2 size={16} strokeWidth={2.2} />
            </span>
            <span className="nav-link-label">Admin</span>
          </NavLink>
        ) : null}
      </nav>
    </header>
  );
}
