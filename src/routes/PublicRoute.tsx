import React from "react";
import { Redirect, Route, RouteProps } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Wrap the login / signup routes with this. If the user already has a
 * valid session, sends them straight into the app instead of showing
 * the login form again.
 */
const PublicRoute: React.FC<RouteProps> = ({ children, ...rest }) => {
  const { isAuthenticated } = useAuth();

  return (
    <Route
      {...rest}
      render={() =>
        isAuthenticated ? <Redirect to="/app/home" /> : <>{children}</>
      }
    />
  );
};

export default PublicRoute;
