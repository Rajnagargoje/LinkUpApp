import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonInput,
  IonPage,
  IonRow,
  IonText,
  useIonLoading,
  useIonRouter,
} from "@ionic/react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import heroImage from "../../public/assets/pic/login-hero.svg";
import "./LoginPage.scss"; // reuse .auth-card / .auth-cta / .auth-heading etc.
import "./VerifyEmailPage.scss";
import { useAuth } from "../contexts/AuthContext";
import * as userService from "../service/userService";

const RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailPage: React.FC = () => {
  const router = useIonRouter();
  const [present, dismiss] = useIonLoading();
  const { user, refreshUser } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const sentOnMount = useRef(false);

  const goNext = () => {
    // Right after register, onboarding isn't done yet — go finish it.
    // Reopened later from Settings (already onboarded) — just go home.
    router.push(
      user?.onboardingCompleted ? "/app/home" : "/onboarding",
      "forward",
      "replace"
    );
  };

  const sendCode = async () => {
    setSending(true);
    try {
      await userService.sendEmailVerificationCode();
      toast.success(`Code sent to ${user?.email ?? "your email"}`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Couldn't send the code. Try again."
      );
    } finally {
      setSending(false);
    }
  };

  // Fire the first code automatically — no button tap needed to get started.
  useEffect(() => {
    if (sentOnMount.current) return;
    sentOnMount.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      return;
    }

    await present("Verifying…");
    try {
      await userService.verifyEmailCode(code);
      await refreshUser();
      dismiss();
      toast.success("Email verified!");
      goNext();
    } catch (err: any) {
      dismiss();
      setError(err?.response?.data?.message || "Incorrect code");
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
                    <h1 className="auth-title">Verify your email</h1>
                    <p className="auth-subtitle">
                      We sent a 6-digit code to <strong>{user?.email}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleVerify} noValidate>
                    <IonInput
                      className={`auth-input verify-code-input${error ? " ion-invalid ion-touched" : ""}`}
                      label="Verification code"
                      type="text"
                      inputmode="numeric"
                      maxlength={6}
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="123456"
                      value={code}
                      onIonInput={(e) =>
                        setCode((e.detail.value ?? "").replace(/\D/g, "").slice(0, 6))
                      }
                      errorText={error}
                    ></IonInput>

                    <IonButton
                      expand="block"
                      type="submit"
                      className="auth-cta auth-cta--primary ion-margin-top"
                      disabled={code.length !== 6}
                    >
                      Verify
                    </IonButton>

                    <div className="verify-resend-row">
                      <IonText color="medium">Didn't get it?</IonText>
                      <IonButton
                        fill="clear"
                        size="small"
                        disabled={cooldown > 0 || sending}
                        onClick={sendCode}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                      </IonButton>
                    </div>

                    <IonButton
                      expand="block"
                      fill="clear"
                      className="ion-margin-top"
                      onClick={goNext}
                    >
                      Skip for now — I'll verify later
                    </IonButton>
                    <p className="verify-skip-note">
                      You can still use LinkUp, but you won't be able to
                      reset your password by email until this is verified.
                    </p>
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

export default VerifyEmailPage;
