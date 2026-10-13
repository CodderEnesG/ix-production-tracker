/*
 * Based on the Siemens iX React starter (MIT, Copyright (c) Siemens 2018 - 2026).
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  IxApplication,
  IxApplicationHeader,
  IxContent,
  IxMenu,
  IxMenuItem,
  IxSpinner,
} from '@siemens/ix-react';
import { iconAdd, iconHome, iconList } from '@siemens/ix-icons/icons';
import './App.css';

// Route-level code splitting: ECharts (dashboard) and AG Grid (orders) are
// large, so each page downloads only what it needs.
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Orders = lazy(() => import('./pages/orders/Orders'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
const NewOrder = lazy(() => import('./pages/orders/NewOrder'));

const NAV = [
  { path: '/', label: 'Dashboard', icon: iconHome },
  { path: '/orders', label: 'Orders', icon: iconList },
  { path: '/orders/new', label: 'New order', icon: iconAdd },
];

function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // "Orders" stays active on detail pages; "New order" only on its own page.
  const isActive = (path: string) =>
    path === '/orders'
      ? pathname.startsWith('/orders') && pathname !== '/orders/new'
      : pathname === path;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <IxApplication>
        <IxApplicationHeader name="Production Order Tracker" nameSuffix="Demo" />

        <IxMenu enableToggleTheme aria-label="Main navigation">
          {NAV.map(item => (
            <IxMenuItem
              key={item.path}
              icon={item.icon}
              active={isActive(item.path)}
              onClick={e => {
                e.preventDefault();
                navigate(item.path);
              }}
            >
              {item.label}
            </IxMenuItem>
          ))}
        </IxMenu>

        <IxContent id="main-content">
          <Suspense fallback={<IxSpinner size="large" className="page-spinner" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/new" element={<NewOrder />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </IxContent>
      </IxApplication>
    </>
  );
}

export default App;
