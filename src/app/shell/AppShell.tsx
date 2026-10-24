/**
 * AppShell — coquille applicative (étape 3) : Sidebar + TopBar +
 * zone de contenu (Outlet). Remplace le Layout antd de App.js.
 *
 * État du shell :
 *  - collapsed (desktop) : persisté localStorage 'gh.sidebar.collapsed'
 *  - drawerOpen (mobile < 960px) : fermé à chaque navigation
 *  - MotionConfig reducedMotion="user" : le mouvement respecte
 *    toujours les préférences système (brief a11y).
 */
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PageTransition } from './PageTransition';
import { PageFallback } from './PageFallback';
import { useMediaQuery, usePersistentState, SIDEBAR_MEDIA_QUERY } from '../../shared/hooks';
import styles from './appShell.module.scss';

export const AppShell = () => {
  const user = useSelector(
    (state: { user?: { currentUser?: { user?: { id?: number | string; username?: string; role?: string } } } }) =>
      state.user?.currentUser?.user,
  );

  const { pathname } = useLocation();
  const isMobile = useMediaQuery(SIDEBAR_MEDIA_QUERY);
  const [collapsed, setCollapsed] = usePersistentState<boolean>('gh.sidebar.collapsed', false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Une navigation ferme le drawer (zéro friction mobile).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const content = (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Aller au contenu principal
      </a>
      <Sidebar
        role={user?.role}
        collapsed={collapsed && !isMobile}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        drawerOpen={isMobile && drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div className={styles.main}>
        <TopBar user={user} onOpenDrawer={() => setDrawerOpen(true)} />
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <PageTransition routeKey={pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </main>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {content}
    </MotionConfig>
  );
};

AppShell.displayName = 'AppShell';
export default AppShell;
