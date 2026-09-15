import React from "react";
import { Redirect, Route, RouteProps } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Wrap any Route that requires a logged-in user with a COMPLETED
 * profile. Unauthenticated visitors are bounced to login; authenticated
 * but not-yet-onboarded users are bounced to /onboarding instead of
 * being allowed into the app shell — otherwise someone could register,
 * get a token immediately (register now returns one), and navigate
 * straight to /app/home without ever finishing their profile.
 *
 * /onboarding itself must NOT be wrapped in this — see App.tsx, it's
 * routed as its own case so a not-yet-onboarded user can actually reach it.
 */
const ProtectedRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Route
      {...rest}
      render={({ location }) => {
        if (!isAuthenticated) {
          return <Redirect to={{ pathname: "/", state: { from: location } }} />;
        }
        if (user && !user.onboardingCompleted) {
          return <Redirect to="/onboarding" />;
        }
        return <>{children}</>;
      }}
    />
  );
};

export default ProtectedRoute;
