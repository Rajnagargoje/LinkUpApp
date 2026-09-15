import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonPage,
  IonRow,
  IonText,
  useIonLoading,
  useIonRouter,
} from "@ionic/react";
import { logInOutline, personCircleOutline } from "ionicons/icons";
import React, { useState } from "react";
import toast from "react-hot-toast";
import heroImage from "../../public/assets/pic/login-hero.svg";
import "./LoginPage.scss";
import { useAuth } from "../contexts/AuthContext";

const LoginPage: React.FC = () => {
  const [present, dismiss] = useIonLoading();
  const router = useIonRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!username.trim()) next.username = "Username or email is required";
    if (!password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) return;

    await present("Logging in…");
    try {
      await login(username.trim(), password);
      dismiss();
      toast.success("Welcome back!");
      router.push("/app/home", "root");
    } catch (error: any) {
      dismiss();
      const message =
        error?.response?.data?.message ||
        (error?.response?.status === 401
          ? "Incorrect username/email or password"
          : "Unable to log in. Please try again.");
      toast.error(message);
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false} className="login-content">
        <div className="auth-hero">
          <img src={heroImage} alt="" className="auth-hero-img" />
        </div>

        <IonGrid fixed>
          <IonRow class="ion-justify-content-center">
            <IonCol size="12" sizeMd="8" sizeLg="6" sizeSm="4">
              <IonCard className="auth-card">
                <IonCardContent>
                  <div className="auth-heading">
                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-subtitle">Log in to keep chatting</p>
                  </div>

                  <form onSubmit={handleLogin} noValidate>
                    <IonInput
                      className={`auth-input${errors.username ? " ion-invalid ion-touched" : ""}`}
                      label="Username or email"
                      type="text"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="your_username or you@email.com"
                      autocomplete="username"
                      value={username}
                      onIonInput={(e) => setUsername(e.detail.value ?? "")}
                      errorText={errors.username}
                    ></IonInput>
                    <IonInput
                      className={`auth-input ion-margin-top${errors.password ? " ion-invalid ion-touched" : ""}`}
                      label="Password"
                      type="password"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="*********"
                      autocomplete="current-password"
                      value={password}
                      onIonInput={(e) => setPassword(e.detail.value ?? "")}
                      errorText={errors.password}
                    ></IonInput>
                    <IonButton
                      expand="block"
                      type="submit"
                      className="auth-cta auth-cta--primary ion-margin-top"
                    >
                      Login
                      <IonIcon icon={logInOutline} slot="end" />
                    </IonButton>
                    <IonButton
                      expand="block"
                      fill="outline"
                      className="auth-cta auth-cta--secondary ion-margin-top"
                      routerLink="/signup"
                    >
                      Sign Up
                      <IonIcon icon={personCircleOutline} slot="end" />
                    </IonButton>
                  </form>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
