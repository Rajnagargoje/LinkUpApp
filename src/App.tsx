import { Redirect, Route, Switch } from "react-router-dom";
import { IonApp, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Toaster } from "react-hot-toast";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Theme variables */
import "./theme/variables.scss";
import AppTabs from "./AppTabs";
import LoginPage from "./authentication/LoginPage";
import SignUpPage from "./authentication/SignUpPage";
import VerifyEmailPage from "./authentication/VerifyEmailPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import OnboardingRoute from "./routes/OnboardingRoute";
import AuthOnlyRoute from "./routes/AuthOnlyRoute";
import SplashScreen from "./components/SplashScreen";

setupIonicReact();

// Split out so it can read useAuth() — the provider has to be above this.
const AppRoutes: React.FC = () => {
  const { isBootstrapping } = useAuth();

  // While we're validating whatever session is in storage, show a
  // splash instead of racing the router (avoids a flash of the wrong
  // screen for both logged-in and logged-out users).
  if (isBootstrapping) {
    return <SplashScreen />;
  }

  return (
    <IonReactRouter>
      <Switch>
        <PublicRoute exact path="/">
          <LoginPage />
        </PublicRoute>
        <PublicRoute exact path="/signup">
          <SignUpPage />
        </PublicRoute>
        {/* Authenticated-only, no onboarding requirement either way —
            reachable right after register AND later from Settings. */}
        <AuthOnlyRoute exact path="/verify-email">
          <VerifyEmailPage />
        </AuthOnlyRoute>
        {/* Authenticated + NOT yet onboarded only (see OnboardingRoute). */}
        <OnboardingRoute exact path="/onboarding">
          <OnboardingPage />
        </OnboardingRoute>
        <ProtectedRoute path="/app">
          <AppTabs />
        </ProtectedRoute>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </IonReactRouter>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <IonApp>
        <Toaster position="top-center" />
        <AppRoutes />
      </IonApp>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
