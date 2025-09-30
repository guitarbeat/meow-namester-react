/**
 * @module components/index
 * @description Central export point for all React components in the application.
 * Provides a clean interface for importing components throughout the app.
 */

export { default as Tournament } from '../../features/tournament/Tournament';
export { default as TournamentSetup } from '../../features/tournament/TournamentSetup';
export { default as Results } from '../../features/tournament/Results';
export { default as ErrorBoundary } from './ErrorBoundary/ErrorBoundary';
export { default as ErrorDisplay } from './ErrorDisplay/ErrorDisplay';
export { default as Login } from '../../features/auth/Login';
export { default as Profile } from '../../features/profile/Profile';
export {
  default as LoadingSpinner,
  SkeletonLoader,
  TournamentSkeleton,
  NameCardSkeleton
} from './LoadingSpinner';
export { default as NameCard } from './NameCard/NameCard';
export { default as CalendarButton } from './CalendarButton/CalendarButton';
export { default as StatsCard } from './StatsCard/StatsCard';

export { default as InlineError } from './InlineError';
export { default as Toast } from './Toast';
export { default as ToastContainer } from './ToastContainer';
export { default as BongoCat } from './BongoCat/BongoCat';
export { default as WelcomeScreen } from './WelcomeScreen/WelcomeScreen';
export { default as NameStatsTooltip } from './NameStatsTooltip/NameStatsTooltip';
export { default as Card } from './Card/Card';
export { default as GroupVersionToggle } from './GroupVersionToggle/GroupVersionToggle';
