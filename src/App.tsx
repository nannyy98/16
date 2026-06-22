import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Register } from './pages/Register';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Favorites } from './pages/Favorites';
import { Contact } from './pages/Contact';
import { Tips } from './pages/Tips';
import { About } from './pages/About';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminBanners } from './pages/admin/AdminBanners';
import { AdminDelivery } from './pages/admin/AdminDelivery';
import { AdminCoupons } from './pages/admin/AdminCoupons';
import { AdminReturns } from './pages/admin/AdminReturns';
import { AdminAuditLog } from './pages/admin/AdminAuditLog';
import { AdminProductForm } from './pages/admin/AdminProductForm';
import { AdminRoute } from './components/AdminRoute';
import { ToastContainer } from './components/Toast';

const WalletPage = lazy(() => import('./pages/Wallet').then(m => ({ default: m.WalletPage })));
const InviteFriends = lazy(() => import('./pages/InviteFriends').then(m => ({ default: m.InviteFriends })));
const AdminEconomy = lazy(() => import('./pages/admin/AdminEconomy').then(m => ({ default: m.AdminEconomy })));

const PageLoader = () => (
  <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-surface-200 border-t-surface-900 rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
          {/* Public shop routes */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/tips" element={<Tips />} />
          <Route path="/about" element={<About />} />
          <Route path="/wallet" element={<Suspense fallback={<PageLoader />}><WalletPage /></Suspense>} />
          <Route path="/invite" element={<Suspense fallback={<PageLoader />}><InviteFriends /></Suspense>} />

          {/* Admin login — public */}
          <Route path="/admin" element={<AdminLogin />} />

          {/* Protected admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProducts />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/products/new"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProductForm />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/products/:id/edit"
            element={
              <AdminRoute requiredRole="seller">
                <AdminProductForm />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AdminRoute requiredRole="manager">
                <AdminOrders />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute requiredRole="admin">
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/banners"
            element={
              <AdminRoute requiredRole="manager">
                <AdminBanners />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/delivery"
            element={
              <AdminRoute requiredRole="manager">
                <AdminDelivery />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/coupons"
            element={
              <AdminRoute requiredRole="manager">
                <AdminCoupons />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/returns"
            element={
              <AdminRoute requiredRole="manager">
                <AdminReturns />
              </AdminRoute>
            }
          />
           <Route
            path="/admin/audit"
            element={
              <AdminRoute requiredRole="admin">
                <AdminAuditLog />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/economy"
            element={
              <AdminRoute requiredRole="admin">
                <Suspense fallback={<PageLoader />}>
                  <AdminEconomy />
                </Suspense>
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
