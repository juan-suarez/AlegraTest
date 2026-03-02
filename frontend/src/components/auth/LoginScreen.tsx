import React from 'react';
import { authService } from '../../auth/authService';
import './LoginScreen.css';

export const LoginScreen: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = () => {
    try {
      setError(null);
      authService.login();
    } catch (loginError) {
      const errorMessage = loginError instanceof Error
        ? loginError.message
        : 'Unable to start login flow.';
      setError(errorMessage);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h2>Inicia sesión</h2>
        <p>Para continuar, autentícate con Cognito Hosted UI.</p>
        {error && <p className="login-error">{error}</p>}
        <button type="button" className="login-button" onClick={handleLogin}>
          Ingresar
        </button>
      </div>
    </div>
  );
};
