import {
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonLabel,
  IonPage,
  IonRow,
  IonSpinner,
  useIonLoading,
} from "@ionic/react";
import { checkmarkCircle, checkmarkOutline, closeCircle } from "ionicons/icons";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useHistory } from "react-router";
import heroImage from "../../public/assets/pic/login-hero.svg";
import "./SignUpPage.scss";
import { useAuth } from "../contexts/AuthContext";
import {
  PASSWORD_POLICY_REGEX,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "../config/api.config";
import * as userService from "../service/userService";

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_FORMAT_REGEX = /^[a-zA-Z0-9_]+$/;
const CHECK_DEBOUNCE_MS = 450;

type AvailabilityState = "idle" | "checking" | "available" | "taken";

const SignUpPage: React.FC = () => {
  const history = useHistory();
  const [present, dismiss] = useIonLoading();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isValidUsernameShape = (value: string) =>
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_FORMAT_REGEX.test(value);

  // Debounced availability check — skips the network call entirely for
  // anything that couldn't pass registration's own validation anyway.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = username.trim();
    if (!isValidUsernameShape(trimmed)) {
      setAvailability("idle");
      setSuggestions([]);
      return;
    }

    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await userService.checkUsernameAvailability(trimmed);
        const { available, suggestions: sugg } = res.data.data;
        setAvailability(available ? "available" : "taken");
        setSuggestions(available ? [] : sugg);
      } catch {
        // Availability check is a nicety, not a gate — fall back to
        // silent (server-side check on submit still applies).
        setAvailability("idle");
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  const applySuggestion = (name: string) => {
    setUsername(name);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    const trimmedUsername = username.trim();

    if (!isValidUsernameShape(trimmedUsername)) {
      next.username = `${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters, letters/numbers/underscore only`;
    } else if (availability === "taken") {
      next.username = "That username is already taken";
    }
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (!PASSWORD_POLICY_REGEX.test(password)) {
      next.password =
        "8+ characters, with an uppercase letter, a number and one of @#$%^&+=!";
    }
    if (confirmPassword !== password) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) return;

    await present("Creating your account…");
    try {
      await register(username.trim(), email.trim(), password);
      dismiss();
      toast.success("Account created!");
      // Register now returns a token immediately, so the new user is
      // already authenticated — send them to verify their email first,
      // then onboarding. No need to pass username/email through
      // location.state anymore; onboarding reads straight from useAuth().
      history.push("/verify-email");
    } catch (error: any) {
      dismiss();
      const message =
        error?.response?.data?.message ||
        (error?.response?.status === 409
          ? "That username or email is already taken"
          : "Unable to create your account. Please try again.");
      toast.error(message);
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false} className="signup-content">
        <div className="auth-hero">
          <img src={heroImage} alt="" className="auth-hero-img" />
        </div>

        <IonGrid fixed>
          <IonRow class="ion-justify-content-center">
            <IonCol size="12" sizeMd="8" sizeLg="6" sizeSm="4">
              <IonCard className="auth-card ion-margin-top">
                <IonCardContent>
                  <div className="auth-heading">
                    <h1 className="auth-title">Join LinkUp</h1>
                    <p className="auth-subtitle">
                      Create an account to start chatting
                    </p>
                  </div>

                  <form onSubmit={handleSignUp} noValidate>
                    <IonInput
                      className={`auth-input${errors.username ? " ion-invalid ion-touched" : ""}`}
                      label="Username"
                      type="text"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="your_username"
                      autocomplete="username"
                      value={username}
                      onIonInput={(e) => setUsername((e.detail.value ?? "").trim())}
                      errorText={errors.username}
                    ></IonInput>

                    <div className="username-availability-row">
                      {availability === "checking" && (
                        <>
                          <IonSpinner name="dots" />
                          <span>Checking availability…</span>
                        </>
                      )}
                      {availability === "available" && (
                        <>
                          <IonIcon icon={checkmarkCircle} color="success" />
                          <span className="available-text">Username available</span>
                        </>
                      )}
                      {availability === "taken" && (
                        <>
                          <IonIcon icon={closeCircle} color="danger" />
                          <span className="taken-text">Already taken</span>
                        </>
                      )}
                    </div>

                    {availability === "taken" && suggestions.length > 0 && (
                      <div className="username-suggestions">
                        {suggestions.map((s) => (
                          <IonChip key={s} onClick={() => applySuggestion(s)}>
                            <IonLabel>{s}</IonLabel>
                          </IonChip>
                        ))}
                      </div>
                    )}

                    <IonInput
                      className={`auth-input ion-margin-top${errors.email ? " ion-invalid ion-touched" : ""}`}
                      label="Email"
                      type="email"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="xyz@gmail.com"
                      autocomplete="email"
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value ?? "")}
                      errorText={errors.email}
                    ></IonInput>
                    <IonInput
                      className={`auth-input ion-margin-top${errors.password ? " ion-invalid ion-touched" : ""}`}
                      label="Password"
                      type="password"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="*********"
                      autocomplete="new-password"
                      value={password}
                      onIonInput={(e) => setPassword(e.detail.value ?? "")}
                      errorText={errors.password}
                      helperText="8+ chars, uppercase, number, and one of @#$%^&+=!"
                    ></IonInput>
                    <IonInput
                      className={`auth-input ion-margin-top${errors.confirmPassword ? " ion-invalid ion-touched" : ""}`}
                      label="Confirm password"
                      type="password"
                      fill="outline"
                      labelPlacement="floating"
                      placeholder="*********"
                      autocomplete="new-password"
                      value={confirmPassword}
                      onIonInput={(e) => setConfirmPassword(e.detail.value ?? "")}
                      errorText={errors.confirmPassword}
                    ></IonInput>
                    <IonButton
                      expand="block"
                      type="submit"
                      className="auth-cta auth-cta--primary ion-margin-top"
                    >
                      Create My Account
                      <IonIcon icon={checkmarkOutline} slot="end" />
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

export default SignUpPage;
