import React from "react";
import { Redirect, Route, RouteProps } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Just requires a valid session — no onboarding-completed check either
 * way. Used for /verify-email, which has to work both right after
 * register (before onboarding starts) and later on, reopened from a
 * Settings reminder for someone who skipped it and is already fully
 * onboarded. ProtectedRoute's onboarding redirect would break the first
 * case; this intentionally skips that check.
 */
const AuthOnlyRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  const { isAuthenticated } = useAuth();

  return (
    <Route
      {...rest}
      render={() => (isAuthenticated ? <>{children}</> : <Redirect to="/" />)}
    />
  );
};

export default AuthOnlyRoute;
