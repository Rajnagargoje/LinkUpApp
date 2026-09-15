import React from "react";
import { Redirect, Route, RouteProps } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * /onboarding sits in an awkward middle state: it needs auth (register
 * now returns a token immediately), but it's not part of the main app
 * shell either. Neither PublicRoute (which would bounce an
 * authenticated-but-not-onboarded user straight to /app/home, fighting
 * with ProtectedRoute's own onboarding redirect) nor ProtectedRoute
 * (which requires onboarding to already be done) fits — hence its own
 * wrapper.
 */
const OnboardingRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Route
      {...rest}
      render={() => {
        if (!isAuthenticated) {
          return <Redirect to="/" />;
        }
        if (user && user.onboardingCompleted) {
          return <Redirect to="/app/home" />;
        }
        return <>{children}</>;
      }}
    />
  );
};

export default OnboardingRoute;
