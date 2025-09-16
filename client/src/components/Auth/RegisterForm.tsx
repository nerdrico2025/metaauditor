import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RegisterFormProps {
  onToggleMode: () => void;
}

export default function RegisterForm({ onToggleMode }: RegisterFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { register, isRegisterPending, registerError } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return;
    }

    register({ firstName, lastName, email, password });
  };

  const passwordMismatch = password !== confirmPassword && confirmPassword.length > 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">{t("register.title")}</CardTitle>
        <CardDescription>
          {t("register.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("register.firstNameLabel")}</Label>
              <Input
                id="firstName"
                type="text"
                placeholder={t("register.firstNamePlaceholder")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isRegisterPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("register.lastNameLabel")}</Label>
              <Input
                id="lastName"
                type="text"
                placeholder={t("register.lastNamePlaceholder")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isRegisterPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("register.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("register.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isRegisterPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("register.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("register.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={isRegisterPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("register.confirmPasswordLabel")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isRegisterPending}
            />
            {passwordMismatch && (
              <p className="text-sm text-red-500">{t("register.passwordMismatch")}</p>
            )}
          </div>

          {registerError && (
            <Alert variant="destructive">
              <AlertDescription>{registerError}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isRegisterPending || passwordMismatch}
          >
            {isRegisterPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("register.registerButton")}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={onToggleMode}
              disabled={isRegisterPending}
            >
              {t("register.loginLink")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}