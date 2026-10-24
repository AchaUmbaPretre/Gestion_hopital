/**
 * PageTransition — transition de page (brief 1.3) : fade + slide 8px,
 * 250ms (--duration-normal), respects prefers-reduced-motion via
 * <MotionConfig reducedMotion="user"> monté dans AppShell.
 * PAS d'AnimatePresence : l'ancienne page disparaît immédiatement,
 * la nouvelle entre en fondu (Speed as a feature — zéro latence perçue).
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export const PageTransition = ({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) => (
  <motion.div
    key={routeKey}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

PageTransition.displayName = 'PageTransition';
export default PageTransition;
