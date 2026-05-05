import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export function requireCustomer(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Please create an account or sign in to complete checkout." });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.role !== "customer") {
      return res.status(403).json({ message: "A customer account is required for checkout." });
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session. Please sign in again." });
  }
}

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const isDedicatedAdmin = payload.role === "admin";
    const isCustomerAdmin =
      payload.role === "customer" && (payload.isAdmin === true || payload.isAdmin === 1);
    if (!isDedicatedAdmin && !isCustomerAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const uid = payload.userId ?? payload.adminId;
    if (uid == null) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.admin = { ...payload, adminId: uid, userId: uid };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}
